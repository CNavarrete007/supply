# SupplyFlow Backend R3A — Control de cambios: solicitud y trazabilidad

**Fecha:** 2026-11-06. **Base:** `supply(1).zip` aportado por el usuario, con backend PHP/CodeIgniter 4.7.5 y R2 de regularización incluido.

## Qué se entrega

R3A implementa el **registro**, consulta y retiro de solicitudes de modificación de requisiciones RF1 (no importadas) que pertenecen al Master Admin autenticado. Es un **incremento del backend**, no el flujo completo del Apps Script original.

- Crear una solicitud `pending_review` sin cambiar folio ni partidas comerciales de la requisición original. Requiere `If-Match`, `Idempotency-Key`, cookie de sesión y CSRF.
- Generación serializada de folio `CR-AAAA-####` por organización y año de la fecha declarada.
- Registro transaccional de entidad, solicitud, diferencias `before_snapshot` / `after_snapshot`, evento de auditoría e idempotencia.
- Cambios propuestos en **fecha requerida**, **lugar de entrega**, y partidas existentes para **modificar** o **cancelar**. No se aplican automáticamente.
- Consultar lista (máx. 250, `truncated` si hay más) y detalle con diferencias.
- Retirar una propuesta pendiente, con motivo obligatorio, auditoría y versión; se conserva el historial. Una solicitud retirada deja de bloquear las ediciones RF1 ordinarias si no hay otras dependencias.
- No se modifica el estado comercial de cotizaciones, RFQ, órdenes de compra, recepciones ni facturas.

**Restricciones:** no contiene decisión de aprobación/rechazo, generación real de `Rev. N`, modificación de partidas, altas de partidas, reabastecimiento, evidencia adjunta ni enmiendas de OC. Estas funciones corresponden a **R3B/R3C**, tras definir la autorización y la reconciliación de dependencias. La opción `Agregar partida` y `action=add` se rechazan intencionalmente. Históricos importados son siempre de solo lectura.

## Archivos de la entrega

**Nuevos (5):**

- `backend/app/Controllers/RequisitionChangeController.php`
- `backend/app/Libraries/RequisitionChangeInput.php`
- `backend/app/Libraries/RequisitionChangeRepository.php`
- `backend/app/Libraries/RequisitionChangeConflict.php`
- `backend/app/Libraries/RequisitionChangeStale.php`

**Modificados (2):**

- `backend/app/Config/Routes.php` (se agregan únicamente las cuatro rutas R3A).
- `backend/app/Libraries/RequisitionRecoveryRepository.php` (retiradas no bloquean edición RF1 indefinidamente).

**Pruebas (2):** `tests/r3a_input_test.php` y `tests/r3a_contract_check.py`.

## Contrato HTTP de R3A

| Método | URL | Finalidad |
| --- | --- | --- |
| `GET` | `/api/v1/recovery/changes?requisition_id=<uuid>` | Consultar cambios RF1 propios |
| `GET` | `/api/v1/recovery/changes/<change_uuid>` | Ver diferencia detallada |
| `POST` | `/api/v1/recovery/requisitions/<req_uuid>/changes` | Registrar solicitud pendiente |
| `POST` | `/api/v1/recovery/changes/<change_uuid>/withdraw` | Retirar pendiente con motivo |

Ejemplo **sintético** de POST para una modificación únicamente de cabecera (no cambia nada en la requisición original):

```http
POST /api/v1/recovery/requisitions/<req_uuid>/changes
Content-Type: application/json
If-Match: "1"
Idempotency-Key: <uuid-distinto-por-intento>
X-SF-CSRF: <valor-de-la-cookie-sf_csrf>
Cookie: sf_session=<sesion>; sf_csrf=<valor>

{
  "date": "2026-11-06",
  "requested_by": "Solicitante sintético",
  "source": "Correo del cliente",
  "change_type": "Cambio de fecha requerida",
  "reference": "CORREO-TEST",
  "reason": "Reprogramación solicitada para una prueba controlada",
  "header": {"need_date": "2026-12-15"},
  "items": []
}
```

`If-Match` al crear usa **`version` de la requisición**, no `current_revision_number`. Al retirar usa **`version` del Change Request**. Leer `detail()` permite obtener ambas versiones sin depender de una suposición.

`pending_review` significa **solicitud pendiente**, no cambio aplicado ni autorización confirmada. El resultado de creación presenta `applied:false`. No reutilizar el código HTTP 201 como prueba de que una revisión ya fue aplicada.

## Requisitos SQL: BLOQUEO DE ACTIVACIÓN HASTA APROBACIÓN SEPARADA

R2/RF1 aprovisionó **exactamente 38 privilegios**. R3A requiere los **cuatro permisos adicionales de tabla** siguientes:

| Tabla | Permiso nuevo | Uso |
| --- | --- | --- |
| `requisition_change_requests` | `INSERT` | Crear solicitud |
| `requisition_change_requests` | `UPDATE` | Retirar solicitud pendiente |
| `requisition_change_items` | `INSERT` | Registrar diferencias propuestas |
| `requisition_change_items` | `SELECT` | Consultar diferencias |

**No conceder estos permisos directamente aún.** El `docker/supply-recovery/provision.py` actual exige exactamente el conjunto de 38 (`actual <= EXPECTED` y `privileges() == EXPECTED`). Añadir 4 de forma independiente provocará `UNEXPECTED_TABLE_PRIVILEGES` cuando `Start`/`verify` vuelva a revisar la cuenta SQL. La actualización del contrato y del aprovisionador a 42 permisos deberá aprobarse y probarse como una operación propia **después de coordinar la activación RF1**. Esta entrega no contiene ni ejecuta `GRANT`, `ALTER`, migración o procedimiento que modifique MariaDB.

La integración API R3A tampoco funcionará con el runtime viejo sin `RECOVERY_DB_USERNAME` y `RECOVERY_DB_PASSWORD_FILE`, que depende del overlay RF1 `Start` todavía no autorizado.

## Comprobaciones locales de esta entrega

- PHP CLI 8.4.24: sintaxis correcta de los 7 archivos `.php`.
- Validación sin base de datos: `27/27` pruebas de entrada.
- Comparación estática de 9 tablas del inventario original y registro de 4 rutas: PASS.
- No se conectó a MariaDB y no se hicieron pruebas HTTP autenticadas de escritura, de concurrencia ni de integración real. No existe aprobación para instalar o activar este incremento en el entorno local.

Para ejecutar las pruebas **después de copiar a una copia aislada completa del proyecto**:

```bash
php tests/r3a_input_test.php
python tests/r3a_contract_check.py
```

**Atención:** los scripts de pruebas no instalan dependencias ni crean datos. No deben ejecutarse como sustitutos de los futuros ensayos transaccionales contra una base sintética.

## Instalación propuesta para una fase posterior (no ejecutada)

1. Respaldar individualmente los 2 archivos modificados; comparar su SHA-256 con `MANIFEST_R3A.json` y confirmar que parten del mismo `supply(1).zip`.
2. Revisar el diff antes de copiar los 7 PHP y 2 tests a una **copia de desarrollo**. No sobrescribir otros archivos.
3. Validar las pruebas y la lista de rutas. Después preparar el contrato acotado de privilegios de R3A con su propia autorización.
4. Probar en una base sintética y sesión de ensayo. Ninguna prueba con escrituras debe usarse sobre requisiciones comerciales reales.

No ejecuta `docker compose up`, `Start`, `Provision`, migraciones, ni modificaciones de los datos. El backend no se ha instalado desde esta conversación.
