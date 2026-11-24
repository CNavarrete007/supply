# Contratista · Datos de la empresa guardados en MariaDB (24 nov 2026)

## Qué se habilitó

En **Contratista → Matriz de contratistas → EDITAR** se abre la empresa de la sesión en la tarjeta **Datos del contratista**.
Ahí se guardan en MariaDB (tabla `organizations`):

| Campo de la pantalla | Columna | Regla del servidor |
|---|---|---|
| Razón social / nombre de la empresa\* | `legal_name` | Obligatoria, hasta 255 caracteres; espacios repetidos se normalizan |
| RFC / Tax ID | `tax_identifier` | Hasta 64: letras, números, `&`, guion, punto y espacio |
| Teléfono de la empresa | `phone` | Hasta 80: dígitos, espacios, `+ ( ) - . /` y «ext»; al menos un dígito |
| Correo de la empresa | `email` | Formato de correo válido, hasta 254 |
| Dirección | `postal_address` | Hasta 4,000; **conserva los saltos de línea** (el campo es de texto multilínea) |
| Logotipo (tarjeta **Identidad y logotipo**) | `logo_file_id` → `files` | PNG, JPG o WEBP; se comprime en el navegador (≤ 400 KB, 512 px, sin metadatos) y el servidor revalida los bytes |

- **Guardar contratista** (o **Guardar contratista y logotipo**) envía un solo `PUT` y, al confirmarse, vuelve a la matriz
  con el aviso «Datos de la empresa guardados en MariaDB (campos…)».
- La matriz muestra la **razón social registrada** debajo del nombre de la identidad y, si se subió un logotipo desde
  SupplyFlow, lo muestra en la columna Logo.
- **Quitar logotipo de la empresa** deja la empresa sin logotipo al guardar (si tenía uno importado, deja de estar vinculado;
  el archivo no se borra).
- **Limpiar** cancela la edición sin guardar nada.

## Qué NO hace (sigue bloqueado)

- **Registrar otras empresas** contratistas: «Guardar contratista» sin haber abierto EDITAR lo explica y no envía nada.
- **Cambiar el estatus** de la empresa activa (el selector queda deshabilitado), **eliminarla** o **activar otra**.
- **Personal / contactos** (`people`): depende de la escritura de Usuarios y roles.
- **Formatos impresos**: la OC, las cotizaciones, el formato de entrega y los reportes siguen usando la identidad
  institucional fija de Grupo Gerez (nombre «Trámites Aduanales Gerez S.C» y logotipo `/image_923273.svg`). Lo que guardes
  aquí **no** cambia esos formatos todavía; conectarlos es un cambio aparte que requiere tu autorización.

## Servidor

| Método | Ruta | Detalle |
|---|---|---|
| `PUT` | `/api/v1/contractors/{id}` | `ContractorWriteController::update` → `ContractorInput` + `ContractorWriteRepository` |
| `GET` | `/api/v1/contractors/{id}/logo` | Logotipo subido desde SupplyFlow (privado, `no-store`); uno importado no se sirve (404) |
| `GET` | `/api/v1/contractors` | Ahora incluye `version` (para `If-Match`) y `logo_stored` |

- Solo **Master Admin** (403 a los demás), CSRF, `Content-Type: application/json` (415), `Idempotency-Key` (422 si falta),
  `If-Match: "<version>"` (428 si falta o no es numérica; 412 `STALE_VERSION` si otra sesión guardó antes).
- Solo la organización de la sesión: otro identificador → 404. Campos desconocidos (incluido `status`) → 422 `body`.
- Errores de validación → 422 `INVALID_CONTRACTOR` con `field` (`legal_name`, `tax_id`, `phone`, `email`, `address`, `logo`).
- Reintentar con la misma clave repite la respuesta (`replayed: true`) sin volver a escribir; la misma clave con otro
  contenido → 409.
- Bitácora: módulo `catalogs`, acción `contractor.update`, con los cambios campo por campo (sin los bytes del logotipo).
  Guardar sin cambios no deja registro.
- Usa la cuenta `supplyflow_catalogwrite_local`, que ahora necesita **35 permisos** (+`SELECT` y `UPDATE` sobre
  `organizations`). La cuenta de la API sigue siendo de solo lectura.

## Activación en la PC (requiere tu autorización)

Tu cuenta `catalogwrite` ya existe con 33 permisos. Solo hay que agregarle los 2 nuevos. Mientras no se haga, la pantalla
muestra el aviso «A la cuenta de escritura del catálogo le faltan permisos · Faltan 2 de 35 (SELECT organizations, UPDATE
organizations)» **solo en Contratista**; Clientes, Proveedores, Suministros y Categorías siguen guardando normalmente.

1. Actualizar el código (`git pull` de la rama) y recargar con **Ctrl+F5**.
2. **Respaldo** (Paso 1 de «Activación en la PC» en `docs/clientes/ALTA_EDICION_CLIENTES.md`, con un nombre nuevo, p. ej.
   `antes-contratista-<fecha>.sql`).
3. Comprobar sin cambiar nada:

   ```powershell
   & docker.exe @compose --profile catalogwrite-tools run --rm catalogwrite-db-tools verify
   ```

   Debe responder `"error_code": "PRIVILEGES_INCOMPLETE"` (faltan los 2 permisos). Si dice `SQL_CREDENTIAL_MISMATCH`,
   **detenerse** y consultar.
4. Agregar los permisos que faltan y verificar:

   ```powershell
   & docker.exe @compose --profile catalogwrite-tools run --rm catalogwrite-db-tools provision
   & docker.exe @compose --profile catalogwrite-tools run --rm catalogwrite-db-tools verify
   ```

   Ambos deben responder `"result": "PASS"` y `"grants": 35`. `provision` no toca datos, esquema ni las cuentas del
   contrato 77/52; solo agrega los permisos faltantes.
5. No hace falta recrear la API: los permisos aplican a la siguiente conexión. Recargar la página: el aviso desaparece y
   `http://localhost:8080/api/v1/catalogs/write-status` muestra `"code":"OK"`.

`$compose` se arma igual que en el Paso 1 de la guía de Clientes, incluyendo `compose.supply-catalogwrite.yml`.

## Pruebas

| Prueba | Tipo | Resultado (sandbox sintético) |
|---|---|---|
| `tests/contractors_write_http_check.py` | HTTP, **escribe** (`SF_SYNTHETIC_WRITES=1`), restaura los datos al final | 31/31 |
| `tests/frontend/contractors_write_ui_e2e.cjs` | Navegador, **escribe** (`SF_SYNTHETIC_WRITES=1`), restaura los datos al final | 21/21 |
| `tests/frontend/contractors_ui_e2e.cjs` | Navegador, solo lectura (aborta toda escritura) | 29/29 |
| `tests/contractors_http_check.py` | HTTP, solo lectura | 19/19 |
| `tests/frontend/contractors_model.test.mjs` | Lógica pura | 9/9 |
| `tests/catalogwrite_contract_check.py`, `tests/catalog_write_status_http_check.py` | Contrato de 35 permisos | 4/4 · 9/9 |

Las pruebas de escritura **no** deben ejecutarse contra tu base real: modifican la empresa de la sesión (aunque la
restauran). En tu PC basta con abrir EDITAR, cambiar un dato y guardar.

## Limitaciones

- El permiso `UPDATE` sobre `organizations` es de tabla completa; el código solo modifica las seis columnas de la tabla de
  arriba y `updated_at`. Restringirlo por columna es posible si lo prefieres (cambio aparte en `provision.py`).
- Un logotipo importado del sistema anterior no se muestra en la pantalla (no está en el almacenamiento privado de
  SupplyFlow); se conserva mientras no subas otro o lo quites.
