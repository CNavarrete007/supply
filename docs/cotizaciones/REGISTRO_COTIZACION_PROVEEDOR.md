# Cotizaciones · Guardar la cotización recibida del proveedor (26 nov 2026)

## Qué se habilitó

| Tarjeta | Botón | Qué guarda en MariaDB |
|---|---|---|
| 4 Registro de cotización | **💾 Guardar cotización** | La cotización que envió el proveedor contra una **RFQ existente** (`supplier_quotes` + `supplier_quote_items`) con folio automático **COT-AAAA-NNNN** (año de hoy, consecutivo) y estatus **«Recibida»**. Guarda referencia del proveedor, fechas, moneda, IVA, días de entrega, condiciones de pago, cumplimiento técnico y documental, comentarios, partidas ofertadas con cantidad y precio unitario, y el **PDF** opcional (privado). Al terminar, conserva comprador y requisición para registrar otra RFQ |
| 4 en modo edición (EDITAR desde la Matriz interna de proveedores) | **💾 Guardar cambios** | Los cambios de una cotización **registrada en SupplyFlow, sin adjudicación vigente y en estatus «Recibida»**, con su versión (If-Match). Puede reemplazar el PDF; el anterior queda como historial |

- **Importes:** el navegador no los envía. El servidor los recalcula con la misma regla de la tarjeta: importe por partida =
  cantidad × precio, redondeado a centavos; IVA por partida redondeado; subtotal, IVA y total.
- **Una cotización por RFQ** (como en tus datos: ninguna RFQ tiene dos). En la lista, las RFQ que ya tienen cotización aparecen
  deshabilitadas («ya cotizada: COT-…»); se corrigen con EDITAR.
- **RFQ en borrador o cancelada:** no reciben cotización (no se enviaron al proveedor).
- **Importadas del sistema original, sin RFQ o adjudicadas:** se conservan como expediente. EDITAR muestra el detalle y el
  motivo.
- **PDF:** solo PDF real (firma `%PDF-`), hasta **8 MB**. Se guarda fuera del sitio público, en el volumen privado de la API
  (`writable/supplyflow_quotes/files`, almacenamiento `supplyflow_quote_private_v1`), y se identifica por su huella SHA-256.
  La matriz interna ofrece **Descargar PDF**, también para los PDF importados.
- **Lecturas:** se actualizan solas porque leen las mismas tablas: matriz interna (tarjeta 11), comparativo (tarjeta 5),
  matriz de RFQ (tarjeta 3: «Respondida · COT-…») y la RFQ de la requisición.
- **Quién puede guardar:** cualquier Master Admin, como en los demás módulos.

## Qué sigue bloqueado

- **Tarjeta 5 «Comparativo y selección preliminar»:** sigue siendo de cálculo. En los datos del sistema original no hay un
  registro de «selección preliminar» separado: la selección del comparativo **es** la adjudicación (`awards`; las cotizaciones
  pasan a «Adjudicada total/parcial» o «No adjudicada»). Guardarla es una autorización comercial, fuera del alcance «solo
  registro interno» que elegiste. Si quieres habilitarla, debe ser un paso aparte, con su propia autorización.
- **Emitir RFQ** (tarjeta 2), **cotización al cliente**, **decisión del cliente**, **adjudicación definitiva** y **OC**.
- **Eliminar cotizaciones** (tarjeta 11).
- **Editar cotizaciones importadas o adjudicadas.**

Como la emisión de RFQ sigue bloqueada, en tu base solo se pueden registrar cotizaciones contra las **RFQ ya importadas** que no
tienen cotización.

## Servidor

| Método | Ruta | Detalle |
|---|---|---|
| `GET` | `/api/v1/quotes/write-status` | Diagnóstico de solo lectura de la cuenta, sin secretos: `OK`, `QUOTE_WRITE_NOT_PROVISIONED`, `QUOTE_WRITE_ACCOUNT_REJECTED`, `QUOTE_WRITE_GRANTS_INCOMPLETE` (lista los faltantes) |
| `POST` | `/api/v1/quotes/supplier-quotes` | Alta (201). Errores: 422 `INVALID_QUOTE` con `field` (o `line:N`), 422 `CURRENCY_UNAVAILABLE`, 404 RFQ, 409 `RFQ_NOT_SENT`, `RFQ_ALREADY_QUOTED`, `LINES_CHANGED`, `REQUISITION_ARCHIVED`; 413 si el cuerpo supera 12 MB |
| `PUT` | `/api/v1/quotes/supplier-quotes/{id}` | Edición. `If-Match: "<versión>"` (428 si falta, 412 si cambió); 409 `IMPORTED_READ_ONLY`, `AWARDED_READ_ONLY`, `STATUS_READ_ONLY` |
| `GET` | `/api/v1/quotes/supplier-quotes/{id}/document` | PDF vigente (adjunto, `no-store`, `nosniff`, verificado por tamaño y SHA-256); 404 sin PDF, 409 si el archivo no está en este equipo |
| `GET` | `/api/v1/quotes/supplier-quotes/{id}` | (ampliado) `version`, `editable`, `edit_block`, `rfq_id`, `requisition_id` y `document` |

- Escrituras solo para Master Admin, con CSRF, JSON e `Idempotency-Key`. Reintentar la misma operación con la misma clave
  devuelve la respuesta original sin duplicar.
- Cada guardado escribe un **evento de flujo** en la requisición (`workflow_events`, `supplier_quote`:
  `quote.recorded` / `quote.updated`) y una entrada en la **bitácora** (módulo `quotes`: `supplier_quote.create`,
  `supplier_quote.update`, con antes/después y partidas cambiadas).
- Clases: `SupplierQuoteWriteController`, `SupplierQuoteInput` y `SupplierQuoteWriteRepository`. La descarga del PDF está en
  `QuoteController` y `QuoteReadRepository` (cuenta de lectura).
- Usa la cuenta **`supplyflow_quotewrite_local`** (overlay `compose.supply-quotewrite.yml`, secreto
  `quotewrite-db-password.txt`):
  - 22 permisos de tabla y 21 de columna.
  - `UPDATE` solo en las columnas editables de `supplier_quotes` y `supplier_quote_items`, en `business_entities`
    (`updated_at`, `updated_by`, `row_version`) y en `entity_files.file_role` (para pasar el PDF anterior a historial).
  - Sin `DELETE`. No puede escribir RFQ, adjudicaciones, cotizaciones al cliente ni OC.
  - El contrato 77/52, catalogwrite, useradmin y mgmtwrite no cambian.

## Activación en la PC (requiere tu autorización)

Mismo procedimiento que usaste para mgmtwrite. En **PowerShell**, desde `C:\Dev\supply`, con la aplicación en marcha.
Primero actualiza la rama (`git pull origin claude/sharp-hawking-rmk7kl`) y recarga con **Ctrl+F5**. Hasta activarla, la
tarjeta 4 muestra el aviso «El guardado de Cotizaciones no está habilitado en este equipo».

**Paso 1 · Variables, overlays y respaldo.**

```powershell
cd C:\Dev\supply
$root = 'C:\Dev\supply'
$env:SUPPLYFLOW_LOCAL_PRIVATE_DIR = 'C:\Dev\supply-docker-private'
$priv = $env:SUPPLYFLOW_LOCAL_PRIVATE_DIR
$secret = Join-Path $priv 'secrets\quotewrite-db-password.txt'
$files = @('docker-compose.yml','compose.supply-db.yml','compose.supply-dev.yml','compose.supply-auth.yml',
           'compose.supply-reqwrite.yml','compose.supply-recovery.yml','compose.supply-dbadmin.yml','compose.supply-catalogwrite.yml')
foreach ($x in 'useradmin','mgmtwrite') { if (Test-Path -LiteralPath (Join-Path $priv "secrets\$x-db-password.txt")) { $files += "compose.supply-$x.yml" } }
$compose = @('compose','-p','supply','--project-directory',$root)
foreach ($f in $files) { $compose += @('-f', (Join-Path $root $f)) }
$backup = Join-Path $priv ("backups\antes-quotewrite-" + (Get-Date -Format 'yyyyMMdd-HHmm') + ".sql")
& docker.exe @compose exec -T db sh -c 'MYSQL_PWD=$(cat /run/secrets/root_password) mariadb-dump -uroot --single-transaction --routines --triggers --events --default-character-set=utf8mb4 --result-file=/tmp/antes-quotewrite.sql supplyflow_dev'
& docker.exe cp supply-db-1:/tmp/antes-quotewrite.sql $backup
& docker.exe @compose exec -T db rm -f /tmp/antes-quotewrite.sql
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
$compose += @('-f', (Join-Path $root 'compose.supply-quotewrite.yml'))
& docker.exe @compose --profile dev config --quiet; if ($LASTEXITCODE) { throw 'Compose inválido' }
& docker.exe @compose --profile quotewrite-tools run --rm quotewrite-db-tools verify
```

**Paso 4 · Crear la cuenta y sus permisos.** Ambos deben responder `"result": "PASS"`, `"grants": 22` y
`"column_grants": 21`.

```powershell
& docker.exe @compose --profile quotewrite-tools run --rm quotewrite-db-tools provision
& docker.exe @compose --profile quotewrite-tools run --rm quotewrite-db-tools verify
```

**Paso 5 · Recrear solo la API con la cuenta.** Debe quedar `healthy`.

```powershell
& docker.exe @compose --profile dev up -d --no-deps --force-recreate api
& docker.exe @compose ps api
```

**Paso 6 · Comprobar.** Con tu sesión de Master Admin abre `http://localhost:8080/api/v1/quotes/write-status`. Debe decir
`"code":"OK"` y `"expected_grants":43`. Recarga Cotizaciones → Cotizaciones recibidas: el aviso amarillo desaparece.

Desde ahora el arranque normal (`CLAUDE.md`, `SupplyFlow-Restore-INT03.ps1`) agrega `compose.supply-quotewrite.yml`
automáticamente si existe su secreto.

## Pruebas

| Prueba | Tipo | Resultado (sandbox sintético) |
|---|---|---|
| `tests/supplier_quote_write_http_check.py` | HTTP, **escribe** (`SF_SYNTHETIC_WRITES=1`); usa RFQ sintéticas `RFQ-QW-*` | 41/41 |
| `tests/frontend/supplier_quote_write_ui_e2e.cjs` | Navegador, **escribe**: alta con fallo de red y reintento con la misma clave, edición con If-Match, PDF reemplazado y descargado | 20/20 |
| `tests/frontend/quotes_ui_e2e.cjs` | Navegador, solo lectura: el guardado se aborta y no se da por guardado | 232/232 |
| `tests/quotes_http_check.py` | HTTP, solo lectura | 159/159 |
| `tests/quotewrite_contract_check.py` | Contrato PHP = `provision.py` (22 + 21) | 8/8 |
| `tests/frontend/supplier_quote.test.mjs` | Lógica pura (cuerpo, edición, mensajes, aviso) | 11/11 |

Las pruebas de escritura **no** deben ejecutarse contra tu base real: registran cotizaciones sintéticas que no se pueden
eliminar. Como la emisión de RFQ sigue bloqueada, en el sandbox las RFQ sintéticas se siembran por SQL.

## Limitaciones

- **Folio COT:** máximo del año más uno (tus datos usan COT-2026-NNNN). El contador heredado del Apps Script no se lee ni se
  modifica.
- **Estatus de la RFQ:** no se modifica (la cuenta no puede escribir RFQ). «Respondida» se deriva de que exista la cotización,
  igual que el contador de la matriz de RFQ.
- **Revisión del PDF:** queda con `scan_status = 'pending'`; no hay antivirus en este entorno.
- **Reglas del Apps Script:** el formulario sigue el diseño y tus datos. Si el sistema original permitía varias cotizaciones por
  RFQ o editar después de adjudicar, envíame esa parte del código para ajustarlo.
