# Cotizaciones · Guardar RFQ, cotizaciones recibidas del proveedor y borrador al cliente (26 nov 2026)

## Qué se habilitó

| Tarjeta | Botón | Qué guarda en MariaDB |
|---|---|---|
| 2 Solicitud a proveedores (RFQ) | **Guardar y siguiente RFQ →** | La RFQ (`rfqs` + `rfq_items`) con folio **RFQ-AAAA-NNNN** (año de la emisión, consecutivo), proveedor, contacto de compras, fechas, moneda, lugar de entrega, documentación, condiciones y las partidas elegidas (1..n, sin precios), en estatus **Borrador** o **Enviada**. Exige que la validación vigente del contratista permita cotizar. Deja la requisición lista para el siguiente proveedor. Detalle: [SOLICITUD_RFQ.md](SOLICITUD_RFQ.md) |
| 3 Matriz de RFQ | **Marcar enviada** | Un Borrador registrado en SupplyFlow pasa a **Enviada** (If-Match), cuando el comprador ya la mandó desde su correo |
| 4 Registro de cotización | **💾 Guardar cotización** | La cotización que envió el proveedor contra una **RFQ existente** (`supplier_quotes` + `supplier_quote_items`) con folio automático **COT-AAAA-NNNN** (año de hoy, consecutivo) y estatus **«Recibida»**. Guarda referencia del proveedor, fechas, moneda, IVA, días de entrega, condiciones de pago, cumplimiento técnico y documental, comentarios, partidas ofertadas con cantidad y precio unitario, y el **PDF** opcional (privado). Al terminar, conserva comprador y requisición para registrar otra RFQ |
| 4 en modo edición (EDITAR desde la Matriz interna de proveedores) | **💾 Guardar cambios** | Los cambios de una cotización **registrada en SupplyFlow, sin adjudicación vigente y en estatus «Recibida»**, con su versión (If-Match). Puede reemplazar el PDF; el anterior queda como historial |
| 6 Cotización formal al cliente | **💾 Guardar cotización al cliente** | La cotización al cliente como **borrador interno** (`customer_quotes` + `customer_quote_versions` + `customer_quote_items`, folio **COT-AAAA-NNNN**, Rev. 0, estatus «Borrador»); si la requisición ya tiene su borrador de SupplyFlow, lo edita (If-Match). Detalle en `COTIZACION_CLIENTE.md` |

- **Importes:** el navegador no los envía. El servidor los recalcula con la misma regla de la tarjeta: importe por partida =
  cantidad × precio, redondeado a centavos; IVA por partida redondeado; subtotal, IVA y total.
- **Una cotización por RFQ** (como en tus datos: ninguna RFQ tiene dos). En la lista, las RFQ que ya tienen cotización aparecen
  deshabilitadas («ya cotizada: COT-…»); se corrigen con EDITAR.
- **RFQ en borrador o cancelada:** no reciben cotización (no se enviaron al proveedor). Márcala como enviada en la tarjeta 3.
- **SupplyFlow no envía correos:** la RFQ registrada se imprime desde la Matriz de RFQ (Ver) y se manda desde el correo del
  comprador.
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
- **Envío automático por correo** de la RFQ (no hay servidor de correo configurado; se decidió solo registrar).
- **Editar las partidas** de una RFQ registrada, **cancelar** o **eliminar** RFQ, y modificar RFQ importadas.
- De la **cotización al cliente**: enviar a revisión, autorizar, emitir/enviar al cliente, crear revisiones nuevas fuera de
  R3A y editar cotizaciones importadas o ya enviadas. Además, **decisión del cliente**, **adjudicación definitiva** y **OC**.
- **Eliminar cotizaciones** (tarjeta 11) y **editar cotizaciones importadas o adjudicadas.**

## Servidor

| Método | Ruta | Detalle |
|---|---|---|
| `GET` | `/api/v1/quotes/write-status` | Diagnóstico de solo lectura de la cuenta, sin secretos: `OK`, `QUOTE_WRITE_NOT_PROVISIONED`, `QUOTE_WRITE_ACCOUNT_REJECTED`, `QUOTE_WRITE_GRANTS_INCOMPLETE` (lista los faltantes) |
| `POST` | `/api/v1/quotes/rfqs` | Alta de la RFQ (201). Errores: 422 `INVALID_RFQ` con `field`, 422 `SUPPLIER_UNAVAILABLE`, `SUPPLIER_NOT_INVITABLE`, `CONTACT_UNAVAILABLE`, `CURRENCY_UNAVAILABLE`; 404 requisición; 409 `REVIEW_REQUIRED`, `REVIEW_BLOCKS_QUOTING`, `LINES_CHANGED`, `REQUISITION_ARCHIVED` |
| `POST` | `/api/v1/quotes/rfqs/{id}/mark-sent` | Borrador → Enviada. Cuerpo `{}`, `If-Match: "<versión>"` (428 si falta, 412 si cambió); 409 `RFQ_NOT_DRAFT`, `IMPORTED_READ_ONLY` |
| `POST` | `/api/v1/quotes/supplier-quotes` | Alta (201). Errores: 422 `INVALID_QUOTE` con `field` (o `line:N`), 422 `CURRENCY_UNAVAILABLE`, 404 RFQ, 409 `RFQ_NOT_SENT`, `RFQ_ALREADY_QUOTED`, `LINES_CHANGED`, `REQUISITION_ARCHIVED`; 413 si el cuerpo supera 12 MB |
| `PUT` | `/api/v1/quotes/supplier-quotes/{id}` | Edición. `If-Match: "<versión>"` (428 si falta, 412 si cambió); 409 `IMPORTED_READ_ONLY`, `AWARDED_READ_ONLY`, `STATUS_READ_ONLY` |
| `GET` | `/api/v1/quotes/supplier-quotes/{id}/document` | PDF vigente (adjunto, `no-store`, `nosniff`, verificado por tamaño y SHA-256); 404 sin PDF, 409 si el archivo no está en este equipo |
| `GET` | `/api/v1/quotes/supplier-quotes/{id}` | (ampliado) `version`, `editable`, `edit_block`, `rfq_id`, `requisition_id` y `document` |
| `POST` | `/api/v1/quotes/customer-quotes` | Tarjeta 6 · alta de la cotización al cliente como **borrador interno** (201). Errores: 422 `INVALID_CUSTOMER_QUOTE` con `field` (o `line:<id>`), 422 `PREPARER_UNAVAILABLE`, `EXCHANGE_RATE_REQUIRED`; 404 requisición; 409 `DRAFT_EXISTS`, `CUSTOMER_QUOTE_EXISTS`, `LINES_CHANGED`, `COST_SOURCE_CHANGED`, `REQUISITION_ARCHIVED` |
| `PUT` | `/api/v1/quotes/customer-quotes/{id}` | Tarjeta 6 · edición del borrador. `If-Match: "<versión>"` (428 si falta, 412 si cambió); 409 `IMPORTED_READ_ONLY`, `NOT_A_DRAFT` |
| `GET` | `/api/v1/quotes/customer-quotes/{id}/draft` | Tarjeta 6 · datos internos del borrador de SupplyFlow para editarlo (cuenta de lectura; 404 para cualquier otra cotización) |

- Escrituras solo para Master Admin, con CSRF, JSON e `Idempotency-Key`. Reintentar la misma operación con la misma clave
  devuelve la respuesta original sin duplicar.
- Cada guardado escribe un **evento de flujo** en la requisición (`workflow_events`: `rfq` → `rfq.recorded` / `rfq.sent`;
  `supplier_quote` → `quote.recorded` / `quote.updated`; `customer_quote` → `cq.draft_saved` / `cq.draft_updated`) y una
  entrada en la **bitácora** (módulo `quotes`: `rfq.create`, `rfq.mark_sent`, `supplier_quote.create`, `supplier_quote.update`,
  `customer_quote.draft_create`, `customer_quote.draft_update`, con antes/después).
- Clases: `SupplierQuoteWriteController` (las 7 rutas de escritura), `RfqInput`, `RfqWriteRepository`, `SupplierQuoteInput`,
  `SupplierQuoteWriteRepository`, `CustomerQuoteInput`, `CustomerQuoteWriteRepository` y la base común `QuoteWriteBase`
  (conexión, permisos, idempotencia, eventos y bitácora). La
  descarga del PDF está en `QuoteController` y `QuoteReadRepository` (cuenta de lectura).
- Usa la cuenta **`supplyflow_quotewrite_local`** (overlay `compose.supply-quotewrite.yml`, secreto
  `quotewrite-db-password.txt`):
  - **35 permisos de tabla y 76 de columna (111)** desde el 26 nov 2026 (antes 29 + 23 = 52).
  - Alta en `rfqs`/`rfq_items`, `supplier_quotes`/`supplier_quote_items` y, para el borrador de la tarjeta 6, en
    `customer_quotes`/`customer_quote_versions`/`customer_quote_items`; lee la validación vigente, el contacto de compras
    (`requisition_reviews`, `users`, `people`, `user_roles`, `roles`) y las políticas de aprobación (`approval_policy_versions`).
  - `UPDATE` solo en `rfqs.status_code`/`legacy_status` (Borrador → Enviada), en las columnas editables de `supplier_quotes` y
    `supplier_quote_items`, en `business_entities` (`updated_at`, `updated_by`, `row_version`), en `entity_files.file_role` y
    en las 39 + 14 columnas de **datos e importes** del borrador al cliente (nunca estatus, emisión, bloqueo, aprobación,
    folio ni versión).
  - Sin `DELETE`. No modifica partidas de RFQ ni escribe adjudicaciones, aprobaciones, decisiones del cliente u OC; no
    puede enviar a revisión, autorizar ni emitir una cotización al cliente.
  - El contrato 77/52, catalogwrite, useradmin y mgmtwrite no cambian.

## Activación en la PC (requiere tu autorización)

Mismo procedimiento que usaste para mgmtwrite. En **PowerShell**, desde `C:\Dev\supply`, con la aplicación en marcha.
Primero actualiza la rama (`git pull origin claude/sharp-hawking-rmk7kl`) y recarga con **Ctrl+F5**. Hasta activarla, las
tarjetas 2, 4 y 6 muestran el aviso «El guardado de Cotizaciones no está habilitado en este equipo».

> **Si ya habías aprovisionado la cuenta** (con 22 + 21 o con 29 + 23 permisos): haz el paso 1 (respaldo); el paso 2 no
> cambia nada porque el secreto ya existe; en el paso 3 `verify` responderá `PRIVILEGES_INCOMPLETE` (esperado: la API
> también avisa `QUOTE_WRITE_GRANTS_INCOMPLETE` y no guarda) y los pasos 4 a 6 agregan **solo** los permisos que faltan
> (59 si venías de 52). No se tocan datos ni otras cuentas.

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

**Paso 4 · Crear la cuenta y sus permisos.** Ambos deben responder `"result": "PASS"`, `"grants": 35` y
`"column_grants": 76`.

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
`"code":"OK"` y `"expected_grants":111`. Recarga Cotizaciones → Solicitud a proveedores, Cotizaciones recibidas y
Cotización al cliente: el aviso amarillo desaparece.

Desde ahora el arranque normal (`CLAUDE.md`, `SupplyFlow-Restore-INT03.ps1`) agrega `compose.supply-quotewrite.yml`
automáticamente si existe su secreto.

## Pruebas

| Prueba | Tipo | Resultado (sandbox sintético) |
|---|---|---|
| `tests/rfq_write_http_check.py` | HTTP, **escribe** (`SF_SYNTHETIC_WRITES=1`); crea sus requisiciones y validaciones por la API | 36/36 |
| `tests/customer_quote_write_http_check.py` | HTTP, **escribe**: borrador de la cotización al cliente (fórmula, monedas, idempotencia, 409/412/428/422, sin rutas de emisión) | 37/37 |
| `tests/frontend/customer_quote_write_ui_e2e.cjs` | Navegador, **escribe**: borrador desde la tarjeta 6 con fallo de red y reintento, edición con If-Match, 412 con recarga y tarjeta 8 | 28/28 |
| `tests/frontend/rfq_write_ui_e2e.cjs` | Navegador, **escribe**: RFQ en Borrador con fallo de red y reintento con la misma clave, otra Enviada, Marcar enviada (If-Match) y disponibilidad en la tarjeta 4 | 19/19 |
| `tests/supplier_quote_write_http_check.py` | HTTP, **escribe**; registra sus propias RFQ por la API | 41/41 |
| `tests/frontend/supplier_quote_write_ui_e2e.cjs` | Navegador, **escribe**: alta con fallo de red y reintento, edición con If-Match, PDF reemplazado y descargado | 23/23 |
| `tests/frontend/quotes_ui_e2e.cjs` | Navegador, solo lectura: los guardados se abortan y no se dan por guardados | 238/238 |
| `tests/quotewrite_contract_check.py` | Contrato PHP = `provision.py` (35 + 76) y columnas prohibidas del borrador al cliente | 11/11 |
| `tests/frontend/rfq_model.test.mjs`, `supplier_quote.test.mjs` | Lógica pura | 13/13 y 11/11 |

Las pruebas de escritura **no** deben ejecutarse contra tu base real: registran requisiciones, validaciones, RFQ, cotizaciones
y borradores al cliente sintéticos que no se pueden eliminar.

## Limitaciones

- **Folio COT:** máximo del año más uno (tus datos usan COT-2026-NNNN). El contador heredado del Apps Script no se lee ni se
  modifica.
- **Estatus de la RFQ:** al registrar la cotización no se cambia; «Respondida» se deriva de que exista la cotización, igual que
  el contador de la matriz de RFQ. MariaDB no guarda la fecha de envío de la RFQ (la matriz muestra «—»).
- **Folio RFQ:** máximo del año de emisión más uno (RFQ-AAAA-NNNN). 7 de tus RFQ importadas usan un sufijo RFQ-AAAA-NNNN-N; si el
  Apps Script lo agregaba con una regla, envíame esa parte para replicarla.
- **Revisión del PDF:** queda con `scan_status = 'pending'`; no hay antivirus en este entorno.
- **Reglas del Apps Script:** el formulario sigue el diseño y tus datos. Si el sistema original permitía varias cotizaciones por
  RFQ o editar después de adjudicar, envíame esa parte del código para ajustarlo.
