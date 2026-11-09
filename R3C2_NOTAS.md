# SupplyFlow Backend R3C2 — Expediente de evaluación de conciliación comercial

**Fecha:** 2026-11-06. **Base:** `supply(2).zip` aportado por el usuario, **más** delta R3C1. **Estado:** código revisable y pruebas aisladas. **No instalado ni ejecutado sobre la MariaDB del usuario.**

## Resultado concreto

R3C2 crea un expediente **versionado, de evaluación y tratamiento propuesto**, para solicitudes R3A con documentos comerciales posteriores. No declara conciliación concluida, no confirma proveedores ni cliente, no emite nuevas cotizaciones/OC y **no elimina el bloqueo R3B `DOWNSTREAM_RECONCILIATION_REQUIRED`**.

- `GET /api/v1/recovery/changes/{change_uuid}/commercial-reconciliation`: únicamente otro usuario `master_admin` de la misma organización (distinto de quien creó la solicitud), con sesión activa. Inventario de dependencias (13 fuentes), número de registros por categoría y SHA-256 del contenido, sin exponer filas de terceros ni IDs numéricos internos. Expone versión de requisición/cambio, última evaluación y si ésta quedó desactualizada.
- `POST /api/v1/recovery/changes/{change_uuid}/commercial-reconciliation`: registra una **evaluación de tratamiento propuesto**, en tabla independiente de solo inserción; no realiza una aprobación. Requiere sesión, CSRF, `If-Match`, `Idempotency-Key` UUID, hash de inventario, versiones actuales, motivo, reconocimiento explícito y tratamiento con motivo para **cada categoría que tenga registros**. Rechaza tipos añadidos, faltantes, versionado obsoleto, solicitudes finales y autoevaluación del solicitante. Usa transacción, lock de organización, idempotencia y auditoría.
- Un nuevo análisis crea `assessment_version+1` sin borrar el histórico anterior. La coincidencia del hash solo describe lo que se observó durante la consulta; no asegura ausencia de escrituras externas concurrentes que no respeten el lock de RF1.
- La consulta sigue siendo informativa; el expediente no modifica las tablas comerciales ni `requisitions`, y no habilita `POST .../decision` si existen documentos posteriores.

### Dependencias evaluadas

`requisition_reviews`, `sourcing_plans`, `rfqs`, `supplier_quotes`, `awards`, `customer_quotes`, `customer_quote_versions`, `purchase_order_requisitions`, `purchase_orders` (mediante enlace), `goods_receipts` (mediante PO enlazada), `service_orders`, `invoices`, `delivery_items`.

El inventario calcula hashes de filas **solo en memoria** y publica **conteos/hashes** por tipo. Limita a 200 filas por tipo y 16 MiB en total. Si excede el alcance, aborta; no asume que lo omitido está libre de impactos. Los tratamientos son **por tipo de dependencia**, no certificaciones por documento individual. Conciliar series, firmas, evidencias, proveedores y costos efectivamente requiere un incremento posterior.

Tratamientos permitidos: `obtain_confirmation`, `prepare_requote`, `prepare_formal_amendment`, `preserve_with_review`, `escalate_manual_review`. Son *propuestas de trabajo*, no operaciones que ejecuten o autoricen esas acciones. `preserve_with_review` requiere una referencia escrita, pero no acredita por sí sola aprobación externa.

### Ejemplo de contrato (no ejecutar sobre registros reales)

La siguiente estructura presupone que `GET` devuelve **solo** dependencias `rfqs` y `purchase_orders` con conteo positivo; en una situación real deben enviarse **todas** las categorías con conteo positivo del reporte, sin inventar hashes ni versiones:

```http
POST /api/v1/recovery/changes/{change_uuid}/commercial-reconciliation
Content-Type: application/json
If-Match: "3"
Idempotency-Key: {nuevo UUID}
X-SF-CSRF: {token CSRF}
Cookie: sf_session=...; sf_csrf=...
```
```json
{
  "assessment_version": 0,
  "requisition_version": 5,
  "inventory_sha256": "<sha256 tomado del GET>",
  "reason": "Evaluación inicial de repercusiones por cambio de cantidades",
  "treatments": {
    "rfqs": {"action": "prepare_requote", "reason": "Confirmar actualización de solicitudes al proveedor", "reference": "RFQ-PENDIENTE"},
    "purchase_orders": {"action": "prepare_formal_amendment", "reason": "Revisar compromisos y autorizaciones de OC", "reference": null}
  },
  "acknowledge_not_approval": true
}
```

`If-Match` y `requisition_version` deben leerse del GET vigente; los números arriba son de ejemplo. `assessment_version=0` solo aplica si todavía no se ha registrado ninguna evaluación. Las respuestas distinguen `assessment_recorded_followup_required` y `commercial_reconciliation_complete=false`.

## Migración SQL y permisos: BLOQUEADOS hasta autorización independiente

- `migrations/manual/R3C2_commercial_assessment_ledger.sql` es propuesta DDL **no ejecutada**, crea `requisition_change_commercial_assessments`, con versionado, FK de requisición/cambio, FK de actor y campos JSON de contenido propuesto.
- R3C1 ya requiere su propio `ALTER TABLE` de `CHECK`, aún no aplicado. El paquete R3C2 no lo ejecuta.
- La cuenta de RF1 tiene **38 permisos SQL**. R3A/R3B elevan el contrato planeado a **46**; R3C2 requiere exactamente **dos privilegios adicionales** sobre la tabla nueva (`SELECT` e `INSERT`), total planeado **48**. R3C2 no introduce permisos de tabla adicionales para las 13 consultas: los `SELECT` sobre `sourcing_plans`, `customer_quotes` y `delivery_items` ya estaban contemplados en los 46 de R3B. No ejecutar `GRANT` manuales.
- El verificador `docker/supply-recovery/provision.py` sigue esperando **38** grants y **74 tablas**. Al incorporar R3C2, el esquema tendrá **75 tablas**; se deberá versionar y probar el aprovisionador conjuntamente, sin alterar el RF1 histórico aplicado.
- No ejecutar `Start`, `Provision`, migraciones ni pruebas con escrituras sobre registros comerciales sin autorización específica y respaldo probado. La API antigua puede no estar montando todavía el secreto RF1.

## Verificación realizada (aislada)

- R3A: **27/27 PASS**; R3B: **28/28 PASS**; R3C1: **41/41 PASS** (pruebas puras).
- R3C2: **33/33 PASS** (validación pura, negativas y normalización de hash binario) y **28/28 PASS** (contrato estático).
- PHP 8.4.24: syntax/lint PASS en los archivos modificados/nuevos.
- No hay evidencia de pruebas HTTP autenticadas, SQL de integración, concurrencia real con otros procesos, reconciliación contable, operación con dos cuentas ni aplicación de una enmienda comercial.

## Siguiente bloque funcional sugerido

**R3C3 — Ejecución y confirmación de conciliación comercial**: política autorizada de documentos individualizados, versiones comerciales nuevas, evidencia válida del proveedor/cliente, flujos independientes de aprobación y compensaciones; nunca modificar una OC/cotización emitida silenciosamente. Antes debe acordarse el contrato de aprobaciones y ensayarse R3A–R3C2 en DB sintética, separando claramente las operaciones con terceros.

## Instalación del código

- **Delta R3C2:** requiere los seis PHP R3C1 ya integrados. Verificar `MANIFEST_R3C2.json`, respaldar originales y copiar solo `backend/` + `tests/` según diferencias; conservar la migración en `migrations/manual` sin ejecutar.
- **Acumulativo R3C1 + R3C2:** diseñado para `supply(2).zip` con R3A/R3B; usar **uno u otro**, no ambos. Contiene cambios R3C1, R3C2 y ambas migraciones propuestas. El manifiesto acumulativo verifica directamente la base `supply(2).zip`.
- Nunca sobrescribir un archivo de trabajo que no coincida con el SHA `source_sha256` esperado. No hay cambios automáticos en tu Windows/Docker.
