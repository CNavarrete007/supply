# Clientes · Alta y actualización reales (12 nov 2026)

## Qué se corrigió

La primera tarjeta de **Clientes** ("Registro y actualización") era solo de consulta: no existía ningún endpoint de
escritura de clientes y ninguna cuenta SQL podía escribir en `clients`. Por eso no se podían llenar campos ni elegir el
logotipo. Ahora la ficha es un formulario completo (diseño de las imágenes de referencia):

- **No. de cliente** y **Razón social**: selector "+ Nuevo cliente / captura manual" / "+ Nueva compañía / captura manual"
  o un cliente registrado (carga todos sus datos). Ambos campos siguen editables.
- Nombre comercial, RFC, **Proyecto\***, **Número de contrato\***, Teléfono (varios separados por "/"), contactos y
  correos con "×" y "+ Agregar otro…", Estatus (Activo/Inactivo/Bloqueado), Dirección, Condiciones comerciales,
  Observaciones.
- **Logotipo**: PNG, JPG o WEBP; se redibuja y comprime en el navegador (máx. 512 px, ≤ 400 KB, sin metadatos) y el
  servidor vuelve a validar los bytes (tipo real y dimensiones). Se puede quitar o reemplazar; el anterior queda en el
  historial. Se sirve solo a Master Admin con `nosniff` y CSP restrictiva; nunca se expone la ruta de almacenamiento.
- **Política de precios y recompra** editable con las opciones del diseño:
  - Precio al cliente: Precio sujeto a nueva cotización (`quote_required`), Precio al cliente garantizado (`guaranteed`),
    Mixta / por partida (`mixed`), Contrato / Price List / Rate Card (`contract`), Revisión manual (`manual`).
  - Abastecimiento: Recotizar proveedores siempre (`requote_always`), Validar costo/proveedor histórico
    (`validate_history`), Reutilizar proveedor/costo si está vigente (`reuse_if_valid`).
  - Vigencia del precio histórico (días, 0 = sin vencimiento), referencia de contrato / Price List, vigencia contractual,
    margen mínimo %.
  - Se guardan **códigos** (la columna admite 32 caracteres y "Contrato / Price List / Rate Card" mide 33). Si un cliente
    importado tiene la etiqueta textual, se reconoce; si tiene un valor fuera del catálogo se muestra como
    "Valor histórico" y **no se modifica** salvo que el usuario elija otra opción. *Confirmar con el Apps Script original
    qué valores guardaba.*
- **Guardado automático y matriz sincronizada** (13 nov 2026): cada cambio de la ficha se guarda solo, 1.5 s después de
  la última edición, en cuanto No. de cliente, razón social, proyecto y número de contrato están completos y todos los
  campos son válidos. La primera vez da de alta al cliente (POST) y después lo actualiza (PUT con su versión); una ráfaga
  de cambios produce **una** sola escritura. Tras cada guardado se refrescan la **Matriz**, los selectores y los
  indicadores sin recargar la ficha (no se pierde lo que se está escribiendo). La matriz muestra "Alta guardada / Cambios
  guardados" con "Mostrar en la matriz" (filtra y resalta la fila "✓ Recién guardado") y "Abrir ficha".
  - Indicador junto al modo de la ficha: qué falta para guardar, "Cambios sin guardar…", "Guardando…" y
    "✓ Guardado automáticamente en la matriz · versión N · hora".
  - **Limpiar**, **Ver matriz**, cambiar de tarjeta o de cliente guardan antes lo pendiente; si el navegador se cierra con
    cambios sin guardar, avisa.
  - Si otra persona guardó antes (412) o la escritura no está habilitada (503), el guardado automático se **pausa** y solo
    se reintenta con "Guardar cliente" o tras "Recargar ficha". Un número duplicado (409) se marca y se reintenta solo al
    corregirlo.
  - Cada guardado automático incrementa la versión y deja su registro en la bitácora (antes/después).
- **Botones de la ficha** (13 nov 2026): solo **💾 Guardar cliente** (alta o actualización según el cliente cargado),
  **🧹 Limpiar** (vacía el formulario y lo deja en modo alta; no borra nada en MariaDB) y **📋 Ver matriz** (abre la
  tarjeta Matriz). Para editar otro cliente se elige en los selectores o con "Ficha" en la matriz; "Nuevo cliente"
  sigue disponible en la matriz.
- **Portal del cliente y su clave**: siguen bloqueados. La tabla `portal_access_tokens` exige claves con hash, vencimiento
  y bitácora; se habilitarán con el diseño de seguridad del Portal. Nunca se guardan claves en texto.

## Seguridad y trazabilidad (servidor)

| Control | Implementación |
|---|---|
| Sesión y rol | Solo `master_admin` (401/403). |
| CSRF | Cookie `sf_csrf` = cabecera `X-SF-CSRF` + verificación de `Origin`. |
| Idempotencia | `Idempotency-Key` (UUID) obligatorio; reintento con la misma clave devuelve la misma respuesta (`replayed`); otra carga con la misma clave → 409. |
| Concurrencia | `PUT` exige `If-Match: "versión"` (`business_entities.row_version`); versión vieja → 412 y la UI ofrece **Recargar ficha**. |
| Unicidad | Número de cliente único por organización (bloqueo `FOR UPDATE`) → 409 `CODE_TAKEN`. |
| Validación | `ClientInput.php` (lista blanca de campos, longitudes, correos, teléfonos, fechas, márgenes, políticas, logotipo por bytes) → 422 con el campo. |
| Auditoría | `audit_events` módulo `catalogs`, acciones `client.create` (estado completo) y `client.update` (antes/después de cada campo, incluidos contactos, correos, teléfonos y logotipo). |
| Datos importados | Se pueden editar (operación de negocio explícita del usuario); la bitácora conserva los valores anteriores. Contactos retirados se **desactivan** (no se borran); correos/teléfonos se concilian por valor y conservan su vínculo con contactos. |
| Transacción | Todo o nada; un error no deja cambios parciales. |

Endpoints: `POST /api/v1/catalogs/clients`, `PUT /api/v1/catalogs/clients/{id}`, `GET /api/v1/catalogs/clients/{id}/logo`.
El detalle `GET /api/v1/catalogs/clients/{id}` añade `version`, `imported` y `logo` (metadatos).

## Cuenta SQL nueva (mínimo privilegio)

No se tocó ninguna cuenta existente (api = SELECT, auth 10+2, reqwrite 27, recovery 52; contrato INT03 77/52 intacto).
Se agrega **`supplyflow_catalogwrite_local`** (catálogos de clientes, proveedores **y suministros**) con 29 permisos de
tabla, sin privilegios globales ni de esquema:

- SELECT: `clients`, `suppliers`, `supplier_offerings`, `categories`, `business_entities`, `party_contacts`, `party_contact_channels`, `idempotency_keys`, `files`, `entity_files`
- INSERT: `business_entities`, `clients`, `suppliers`, `supplier_offerings`, `party_contacts`, `party_contact_channels`, `audit_events`, `idempotency_keys`, `files`, `entity_files`
- UPDATE: `business_entities`, `clients`, `suppliers`, `supplier_offerings`, `party_contacts`, `party_contact_channels`, `idempotency_keys`, `entity_files`
- DELETE: `party_contact_channels` (correos/teléfonos retirados)

La lógica común de escritura vive en `CatalogWriteBase` / `CatalogWriteController` (backend) y en `src/views/catalog/useCatalogAutosave.js` + `writeApi.js` (frontend); Proveedores la reutiliza (ver `docs/proveedores/ALTA_EDICION_PROVEEDORES.md`).

Archivos: `docker/supply-catalogwrite/provision.py` (provision | verify; no modifica datos ni esquema) y el overlay
opcional `compose.supply-catalogwrite.yml`. **Mientras no se active, el arranque actual no cambia**: la API responde
503 `CATALOG_WRITE_NOT_PROVISIONED` al guardar y la ficha lo indica en ámbar sin perder lo capturado.

## Activación en la PC (requiere autorización explícita)

> Crea una cuenta SQL y recrea solo el contenedor `api`. Hacer antes un respaldo SQL posterior a INT03.
> No agregues el overlay a la lista de arranque antes de crear el secreto: Compose fallaría por el archivo faltante.

```powershell
$root = 'C:\Dev\supply'
$env:SUPPLYFLOW_LOCAL_PRIVATE_DIR = 'C:\Dev\supply-docker-private'
$secret = Join-Path $env:SUPPLYFLOW_LOCAL_PRIVATE_DIR 'secrets\catalogwrite-db-password.txt'
if (-not (Test-Path -LiteralPath $secret)) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $_.ToString('x2') }) | Set-Content -LiteralPath $secret -NoNewline -Encoding ascii
}
# Aplicar al archivo las mismas ACL que a los demás secretos. No mostrar su contenido.
$files = @('docker-compose.yml','compose.supply-db.yml','compose.supply-dev.yml','compose.supply-auth.yml',
           'compose.supply-reqwrite.yml','compose.supply-recovery.yml','compose.supply-dbadmin.yml','compose.supply-catalogwrite.yml')
$compose = @('compose','-p','supply','--project-directory',$root)
foreach ($f in $files) { $compose += @('-f', (Join-Path $root $f)) }
& docker.exe @compose --profile dev config --quiet
& docker.exe @compose --profile catalogwrite-tools run --rm catalogwrite-db-tools provision
& docker.exe @compose --profile catalogwrite-tools run --rm catalogwrite-db-tools verify
& docker.exe @compose --profile dev up -d --no-deps --force-recreate api
```

Comprobaciones: `verify` → `"result": "PASS"`, `"grants": 29`; `http://localhost:8080/api/v1/recovery/catalogs` sin
sesión → 401; en Clientes, dar de alta un cliente de prueba identificable y revisarlo en la bitácora (Usuarios y roles →
Bitácora, módulo `catalogs`). Desde entonces, incluir `compose.supply-catalogwrite.yml` en la lista de overlays.

**Reversión**: quitar el overlay de la lista y recrear solo `api` (el guardado vuelve a 503). Eliminar la cuenta SQL solo
con autorización.

## Pruebas

| Prueba | Resultado (sandbox sintético) |
|---|---|
| `tests/frontend/clients_form.test.mjs` (lógica del formulario y firma del guardado automático) | 6/6 |
| `tests/frontend/clients_model.test.mjs` | 6/6 |
| `tests/clients_write_http_check.py` (contrato de escritura; **solo base desechable**, `SF_SYNTHETIC_WRITES=1`) | 44/44 |
| `tests/frontend/clients_write_ui_e2e.cjs` (alta y edición automáticas, matriz sincronizada, guardado manual, conflicto en pausa, Limpiar/Ver matriz guardan lo pendiente, duplicado; **solo base desechable**) | 40/40 |
| `tests/frontend/clients_ui_e2e.cjs` (consulta, sin escrituras) | 29/29 |
