# Gestión del Contratista · Guardar validación interna y estrategia (25 nov 2026)

## Qué se habilitó

| Tarjeta | Botón | Qué guarda en MariaDB |
|---|---|---|
| 1 Registro de validación | **💾 Guardar validación** | Una validación interna nueva (`requisition_reviews`) con folio automático **SCI-AAAA-NNNN** (año de hoy, consecutivo). Incluye responsable de compras, resultados técnico, contractual y presupuestal, estrategia, mínimo de cotizaciones, fecha límite, criterios y observaciones. Al terminar, el formulario se limpia |
| 1 en modo edición (EDITAR desde la Matriz) | **💾 Guardar cambios** | Los cambios de una validación **registrada en SupplyFlow**, con su versión (If-Match). Las importadas del sistema original se conservan como expediente: el botón se deshabilita y explica que hay que registrar una nueva |
| 2 Estrategia y lotificación | **💾 Guardar estrategia** / **Guardar y abrir siguiente RFQ →** | El plan de abastecimiento como **versión nueva** (`sourcing_plans` v+1): lotes con nombre y mínimo, partidas de cada lote con su estrategia, y proveedores seleccionados y sugeridos. Las partidas «Precio histórico auto» van sin lote y quedan registradas en el evento del plan |

- **Quién puede validar:** cualquier Master Admin. Puede ser quien creó la requisición, como en tus datos importados.
- **Responsable de compras:** debe ser personal activo con usuario activo en SupplyFlow.
- **Reglas:** las mismas del formulario.
  - Mínimo de cotizaciones de 1 a 20.
  - La fecha límite no puede ser anterior a hoy, salvo que la fecha registrada no se cambie al editar.
  - Criterios obligatorios.
  - Justificación de al menos 10 caracteres con fuente única, un resultado no conforme o sin presupuesto.
- **«¿Puede cotizar?»:** técnica y contractual conformes o con observaciones, y presupuesto disponible o parcial. Guardar la
  estrategia exige que la **validación vigente** (la más reciente) lo permita.
- **Versiones del plan:** los planes anteriores, incluidos los importados, no se modifican. Sus RFQ se siguen mostrando en el
  lote del plan vigente que tenga el mismo nombre.
- **Matriz y Reglas inteligentes:** se actualizan solas, porque leen las mismas tablas.

## Qué sigue bloqueado

- **Abrir siguiente RFQ:** indica el siguiente proveedor del lote, pero no crea la RFQ aquí. Desde el 26 nov 2026 las RFQ
  se registran en Cotizaciones → Solicitud a proveedores (RFQ) (`docs/cotizaciones/SOLICITUD_RFQ.md`); SupplyFlow no envía
  correos. Adjudicar, cotizar al cliente y emitir OC siguen bloqueados.
- **Eliminar validaciones** y **Registrar fuente de costo** (Matriz).
- **Editar validaciones importadas.**
- **Editar los parámetros de Reglas inteligentes:** depende de Configuración.

## Servidor

| Método | Ruta | Detalle |
|---|---|---|
| `GET` | `/api/v1/contractor-management/write-status` | Diagnóstico de solo lectura de la cuenta, sin secretos: `OK`, `MGMT_WRITE_NOT_PROVISIONED`, `MGMT_WRITE_ACCOUNT_REJECTED`, `MGMT_WRITE_GRANTS_INCOMPLETE` (lista los faltantes) |
| `POST` | `/api/v1/contractor-management/validations` | Alta (201). Errores: 422 `INVALID_VALIDATION` con `field`, 422 `BUYER_UNAVAILABLE`, 404 |
| `PUT` | `/api/v1/contractor-management/validations/{id}` | Edición. `If-Match: "<versión>"` (428 si falta, 412 si cambió); 409 `IMPORTED_READ_ONLY` |
| `PUT` | `/api/v1/contractor-management/strategy/{requisición}` | Plan versión N+1. `If-Match: "<versión vigente>"` (`"0"` sin plan; 412 si otra sesión guardó). 409 `REVIEW_REQUIRED`, `REVIEW_BLOCKS_QUOTING` o `LINES_CHANGED`; 422 `INVALID_STRATEGY`, `SUPPLIER_NOT_ASSIGNABLE` o `SUPPLIER_UNAVAILABLE` |

- Solo Master Admin, con CSRF, JSON e `Idempotency-Key`. Reintentar la misma operación con la misma clave devuelve la
  respuesta original, sin duplicar ni crear otra versión.
- Además de los registros, cada guardado escribe un **evento de flujo** en `workflow_events` (`contractor_validation` /
  `sourcing_strategy`) y una entrada en la **bitácora** (módulo `contractor_management`: `review.create`, `review.update`,
  `strategy.save`).
- Clases: `ContractorMgmtWriteController`, `ContractorMgmtInput` y `ContractorMgmtWriteRepository`.
- Usa la cuenta **`supplyflow_mgmtwrite_local`** (overlay `compose.supply-mgmtwrite.yml`, secreto
  `mgmtwrite-db-password.txt`):
  - 20 permisos de tabla y 13 de columna.
  - `UPDATE` solo en las columnas editables de `requisition_reviews` y en `business_entities` (`updated_at`, `updated_by`,
    `row_version`).
  - Sin `DELETE`. No puede escribir RFQ, cotizaciones ni OC.
  - El contrato 77/52, catalogwrite y useradmin no cambian.

## Activación en la PC (requiere tu autorización)

Mismo procedimiento que usaste para catalogwrite. En **PowerShell**, desde `C:\Dev\supply`, con la aplicación en marcha.
Primero actualiza la rama y recarga con **Ctrl+F5**. Hasta activarla, las tarjetas 1 y 2 muestran el aviso «El guardado de
Gestión del Contratista no está habilitado en este equipo».

**Paso 1 · Variables, overlays y respaldo.**

```powershell
cd C:\Dev\supply
$root = 'C:\Dev\supply'
$env:SUPPLYFLOW_LOCAL_PRIVATE_DIR = 'C:\Dev\supply-docker-private'
$priv = $env:SUPPLYFLOW_LOCAL_PRIVATE_DIR
$secret = Join-Path $priv 'secrets\mgmtwrite-db-password.txt'
$files = @('docker-compose.yml','compose.supply-db.yml','compose.supply-dev.yml','compose.supply-auth.yml',
           'compose.supply-reqwrite.yml','compose.supply-recovery.yml','compose.supply-dbadmin.yml','compose.supply-catalogwrite.yml')
if (Test-Path -LiteralPath (Join-Path $priv 'secrets\useradmin-db-password.txt')) { $files += 'compose.supply-useradmin.yml' }
$compose = @('compose','-p','supply','--project-directory',$root)
foreach ($f in $files) { $compose += @('-f', (Join-Path $root $f)) }
$backup = Join-Path $priv ("backups\antes-mgmtwrite-" + (Get-Date -Format 'yyyyMMdd-HHmm') + ".sql")
& docker.exe @compose exec -T db sh -c 'MYSQL_PWD=$(cat /run/secrets/root_password) mariadb-dump -uroot --single-transaction --routines --triggers --events --default-character-set=utf8mb4 --result-file=/tmp/antes-mgmtwrite.sql supplyflow_dev'
& docker.exe cp supply-db-1:/tmp/antes-mgmtwrite.sql $backup
& docker.exe @compose exec -T db rm -f /tmp/antes-mgmtwrite.sql
Get-Item $backup | Select-Object Name, Length
```

El respaldo debe pesar varios MB. Si es 0 o hay error, **detenerse**.

**Paso 2 · Secreto de la cuenta.** Son 64 caracteres hexadecimales aleatorios y no se muestran. Se copian los permisos de
Windows de otro secreto.

```powershell
if (-not (Test-Path -LiteralPath $secret)) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $_.ToString('x2') }) | Set-Content -LiteralPath $secret -NoNewline -Encoding ascii
}
$ref = Get-Acl -LiteralPath (Join-Path $priv 'secrets\api-db-password.txt')
$acl = Get-Acl -LiteralPath $secret
$acl.SetSecurityDescriptorSddlForm($ref.GetSecurityDescriptorSddlForm('Access'), 'Access')
Set-Acl -LiteralPath $secret -AclObject $acl
```

**Paso 3 · Agregar el overlay y comprobar sin cambiar nada.** Debe responder `"error_code": "SQL_ACCOUNT_MISSING"`. Si dice
`SQL_CREDENTIAL_MISMATCH`, **detenerse**.

```powershell
$compose += @('-f', (Join-Path $root 'compose.supply-mgmtwrite.yml'))
& docker.exe @compose --profile dev config --quiet; if ($LASTEXITCODE) { throw 'Compose inválido' }
& docker.exe @compose --profile mgmtwrite-tools run --rm mgmtwrite-db-tools verify
```

**Paso 4 · Crear la cuenta y sus permisos.** Ambos deben responder `"result": "PASS"`, `"grants": 20` y
`"column_grants": 13`.

```powershell
& docker.exe @compose --profile mgmtwrite-tools run --rm mgmtwrite-db-tools provision
& docker.exe @compose --profile mgmtwrite-tools run --rm mgmtwrite-db-tools verify
```

**Paso 5 · Recrear solo la API con la cuenta.** Debe quedar `healthy`.

```powershell
& docker.exe @compose --profile dev up -d --no-deps --force-recreate api
& docker.exe @compose ps api
```

**Paso 6 · Comprobar.** Con tu sesión de Master Admin abre
`http://localhost:8080/api/v1/contractor-management/write-status`. Debe decir `"code":"OK"` y `"expected_grants":33`.
Recarga Gestión del Contratista: el aviso amarillo desaparece.

Desde ahora el arranque normal (`CLAUDE.md`, `SupplyFlow-Restore-INT03.ps1`) agrega `compose.supply-mgmtwrite.yml`
automáticamente si existe su secreto.

## Pruebas

| Prueba | Tipo | Resultado (sandbox sintético) |
|---|---|---|
| `tests/contractor_mgmt_write_http_check.py` | HTTP, **escribe** (`SF_SYNTHETIC_WRITES=1`); crea su propia requisición | 33/33 |
| `tests/frontend/contractor_mgmt_write_ui_e2e.cjs` | Navegador, **escribe**: alta con fallo de red y reintento con la misma clave, edición con If-Match y plan v1 | 14/14 |
| `tests/frontend/contractor_mgmt_ui_e2e.cjs` | Navegador, solo lectura: los guardados se abortan y no se dan por guardados | 75/75 |
| `tests/contractor_mgmt_http_check.py` | HTTP, solo lectura | 37/37 |
| `tests/mgmtwrite_contract_check.py` | Contrato PHP = `provision.py` (20 + 13) | 6/6 |
| `tests/frontend/validation_form.test.mjs`, `validation_matrix.test.mjs`, `strategy_model.test.mjs` | Lógica pura | incluidas en 406/406 |

Las pruebas de escritura **no** deben ejecutarse contra tu base real: crean requisiciones, validaciones y planes
sintéticos que no se pueden eliminar.

## Limitaciones

- **Folio SCI:** es el máximo del año más uno. El contador heredado `legacy_counters.review` del Apps Script no se lee ni se
  modifica. Si el Apps Script numeraba de otra forma (p. ej. sin reiniciar por año), avísame.
- **Regla «¿puede cotizar?» y estrategias:** son las del diseño y de tus datos. No hay fuente del Apps Script para validar
  reglas adicionales.
- **Partidas «Precio histórico auto»:** el esquema no tiene dónde guardar la estrategia de una partida sin lote, por eso se
  registra en el evento del plan y se relee de ahí.
