# SupplyFlow R3C1 — Altas de partidas e impacto comercial verificable

**Base exacta:** ZIP aportado `supply(2).zip` (2026-11-06), que contiene R2, R3A y R3B integrados. Se cotejó el manifiesto R3B del ZIP de origen: sus archivos coincidían binariamente antes de elaborar este delta. **Entrega: código fuente y pruebas locales, NO instalado ni activado en tu Windows.**

## Qué se desarrolló (R3C1)

1. La solicitud `POST /api/v1/recovery/requisitions/{uuid}/changes` admite una o hasta **20 nuevas partidas** con `action=add`, descripción, cantidad decimal textual, unidad y categoría existente activa. No acepta ID de partida nuevo enviado por el cliente: el UUID se genera en el servidor. `change_type` debe ser `Agregar partida` o `Cambio de alcance` y `Agregar partida` exige al menos un `add`.
2. La solicitud permanece `pending_review` y no crea artículos ni cambios comerciales inmediatamente. La propuesta R3C utiliza diferencia `target_kind=item`, `change_kind=add`, `snapshot_schema_version=2`, antes `{"status":"not_created"}` y después `{id,description,quantity,unit,category}`; queda preparada para la validación de otro Master Admin dentro de la organización.
3. La aprobación R3B existente, cuando todas sus precondiciones se cumplen, admite insertar partidas **en la misma transacción** de la revisión. Revalida propuestas y categorías; añade `line_number` después del máximo histórico incluyendo canceladas, `created_by_change_request_id` y la asociación `requisition_change_items.requisition_item_id` a la fila nueva. Conserva snapshot antes/después, hash, auditoría, versión, concurrencia e idempotencia ya contempladas en R3B. Si falla cualquier operación, se revierte la transacción SQL.
4. Se añadió `GET /api/v1/recovery/changes/{change_uuid}/impact` **solo para revisor Master Admin distinto del solicitante**. Resume por tabla la **presencia** de planes, RFQ, cotizaciones, órdenes, entregas y otras dependencias; reporta colisión de numeración de snapshot y si la revisión base todavía coincide. Es **informativo**, no autoriza ni reserva. La aprobación vuelve a comprobar dependencias dentro de la transacción.
5. **Se mantiene el bloqueo** `DOWNSTREAM_RECONCILIATION_REQUIRED` ante cualquier documento comercial posterior, y `SNAPSHOT_NUMBER_OCCUPIED` si R2 y R3 compiten por el número de revisión. El paquete **NO** modifica RFQ, ofertas, cotizaciones de cliente, proveedores, órdenes de compra, recepciones, facturas ni entregas. Tampoco autoriza recotización o enmienda de OC de forma automática.

### HTTP del incremento

- `POST /api/v1/recovery/requisitions/{uuid}/changes` ya existía: amplía `items` para `action=add`. Conserva sesión, CSRF, `If-Match` de requisición e `Idempotency-Key` UUID.
- `GET /api/v1/recovery/changes/{uuid}/impact` nueva lectura: sesión y Master Admin revisor independiente, sin IDs numéricos internos y con `Cache-Control: private, no-store`.
- `POST /api/v1/recovery/changes/{uuid}/decision` ya existía: aprobar/rechazar conserva sesión, CSRF, versión e idempotencia; ahora puede aplicar una propuesta con alta, **solo sin dependencias comerciales**.

**Ejemplo exclusivamente de contrato, no ejecutar sobre registros reales:**

```json
{
  "date": "2026-11-06",
  "requested_by": "Solicitante de prueba",
  "source": "Correo del cliente",
  "change_type": "Agregar partida",
  "reference": "CORR-TEST-01",
  "reason": "Agregar material requerido para ensayo",
  "header": {},
  "items": [
    {"action": "add", "description": "Válvula de prueba", "quantity": "2.000000", "unit": "PZA", "category": "Materiales"}
  ]
}
```

## Bloqueos de integración (no se hacen modificaciones aquí)

**A. Migración manual obligatoria.** El `CHECK ck_reqchangeitems_target` del esquema v0.3 exige `requisition_item_id NOT NULL` para `target_kind=item`, salvo `legacy_unresolved`. No es correcto reutilizar ese estado legacy para propuestas nuevas. Por eso el delta contiene `migrations/manual/R3C1_requisition_change_add_check.sql`, con un `ALTER TABLE` que agrega **exclusivamente** la excepción `change_kind=add`, `snapshot_schema_version=2`, estado `proposed/applied/rejected` y `requisition_item_id=NULL`. Las demás condiciones se preservan. **No se ejecutó ni se incluye en un instalador.** Antes de ejecutarlo requiere revisar el CHECK real, backup verificado, base sintética, pruebas DDL y autorización humana independiente. El DDL puede tomar metadatos bloqueados y tiene efectos no transaccionales.

**B. Permisos SQL sin actualizar.** `docker/supply-recovery/provision.py` continúa exigiendo exactamente **38** privilegios SQL. R3A/R3B necesitan ampliar el contrato a **46**; R3C1 reutiliza `INSERT requisition_items` y `UPDATE requisition_change_items` ya contemplados en ese conjunto, por lo que **no añade privilegios de tabla sobre los 46 previstos**. No dar `GRANT` manual: el verificador actual detectaría privilegios inesperados. Se necesita cambio coordinado del aprovisionador y autorización independiente.

**C. Runtime e integración.** La configuración RF1 de API/Nginx sigue sin activación autorizada. Este ZIP no ejecuta `Start`, no altera contenedores ni MariaDB. No hay validación HTTP autenticada, integración MariaDB, persistencia, rollback en DB real, carga con concurrencia o validación con dos usuarios reales. Los resultados de pruebas de lógica no equivalen a aprobación productiva.

**D. Deliberadamente fuera de alcance R3C1.** Conciliación/aprobación formal de documentos ya emitidos, enmiendas de órdenes de compra, recotización y confirmación de proveedores, anexos de evidencia del cambio y resolución de conflicto R2/R3 de snapshots. Requieren contrato comercial y pruebas aisladas propias (**R3C2**), no cambios implícitos a documentos reales.

## Cómo integrar el código en una copia de desarrollo

1. Conserva backup o commit de `supply(2).zip`; verifica `MANIFEST_R3C.json`. Este es un **delta**; no hay que reimportar R3A ni R3B.
2. Revisa y copia **solo** los seis PHP indicados en `MANIFEST_R3C.json`, más los dos archivos de pruebas. Confirma hashes actuales equivalentes a `source_sha256` antes de sobrescribir cualquiera. No sobrescribas archivos que tengan cambios posteriores.
3. Guarda la migración SQL en el repositorio como **artefacto propuesto**, sin ejecutarla todavía. No habilites el endpoint de escritura contra MariaDB real hasta completar A/B/C.
4. En una copia aislada, ejecuta `php tests/r3a_input_test.php`, `php tests/r3b_application_test.php`, `php tests/r3c_additions_test.php` y los chequeos Python `tests/r3a_contract_check.py`, `tests/r3b_contract_check.py`, `tests/r3c_contract_check.py`.
5. Antes de cualquier prueba integrada: alinear versión del esquema/`CHECK`, privilegios mínimos, runtime y realizar pruebas sintéticas con **dos usuarios Master Admin distintos** (creación, validación, aprobación/rechazo, rollback, idempotencia, concurrencia y dependencias comerciales presentes). No probar escrituras con datos importados/reales.

## Verificación en este laboratorio

- Pruebas heredadas: R3A 27/27, R3B 28/28.
- R3C1: 41/41 pruebas de entrada/plan puro y 24/24 chequeos de contrato, sin DB.
- PHP 8.4.24: sintaxis correcta en los seis archivos PHP modificados y el resto del kit.
- Manifiesto con hashes SHA-256 fuente/destino. ZIP íntegro comprobado localmente.

**Estado:** R3C1 como entrega de backend fuente revisable; **no está activado ni integrado en la MariaDB del usuario**.
