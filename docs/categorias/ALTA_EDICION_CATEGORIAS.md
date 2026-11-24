# Catálogo de categorías · Alta, edición, estatus y eliminación reales (24 nov 2026)

Solicitud / Requisición › tarjeta 4 **Catálogo de categorías**. Hasta el 23 nov la pantalla validaba, pero no guardaba
(«Datos validados, pero no se guardó…»). Ahora guarda en MariaDB con la cuenta existente `supplyflow_catalogwrite_local`
(la misma de Clientes, Proveedores y Suministros), con 4 permisos de tabla más.

## Qué hace la pantalla

- **Nueva categoría → Guardar**: da de alta la categoría con un código `cat_<nombre sin acentos>` (`_2`, `_3`… si ya
  existe). Si queda **Activa**, aparece de inmediato en la lista de categorías de las partidas de *Registro de requisición*,
  sin recargar la página.
- **EDITAR → Guardar**: cambia nombre, descripción o estatus. Si queda **Inactiva**, deja de ofrecerse para partidas
  nuevas; las partidas existentes conservan su categoría y su etiqueta histórica.
- **ELIMINAR**: solo para una categoría **nunca usada** (sin partidas, proveedores ni suministros) y escribiendo su nombre
  exacto. Si tiene uso, la pantalla y el servidor lo impiden y ofrecen **Desactivar en su lugar**.
- Al guardar, el formulario se limpia y se bloquea, y aparece el resultado: «Categoría «…» registrada en MariaDB con el
  código …» o «Cambios de «…» guardados en MariaDB (campos)».
- **Sin respuesta del servidor** (red caída, tiempo agotado): no se da por guardado. Aparece **Reintentar**, que repite la
  misma operación con la misma clave de idempotencia; si el servidor ya la había aplicado, devuelve el mismo resultado
  sin duplicarla.
- **Otro usuario la cambió mientras estaba abierta**: el servidor responde 412 y no sobrescribe. La pantalla abre la
  versión vigente de MariaDB para que se vuelvan a aplicar los cambios.
- Sin la cuenta `catalogwrite` aprovisionada, el guardado responde 503 y la pantalla avisa que aún no está habilitado en
  ese equipo; no se pierde nada ni se simula el guardado.

## Servidor

| Ruta | Uso |
|---|---|
| `GET /api/v1/catalogs/categories` | Lectura (cuenta API de solo `SELECT`). Cada categoría trae `version` |
| `POST /api/v1/catalogs/categories` | Alta → 201 (`code`, `version`) |
| `PUT /api/v1/catalogs/categories/{code}` | Edición con `If-Match: "<version>"` → 200 (`changed`, `version`) |
| `DELETE /api/v1/catalogs/categories/{code}` | Eliminación con `If-Match`, solo si nunca se usó → 200 |

- Archivos: `CategoryWriteController`, `CategoryWriteRepository`, `CategoryInput` y `CategoryReadRepository::version()`.
- Controles comunes a toda escritura de catálogos (`CatalogWriteController` / `CatalogWriteBase`):
  - Sesión de Master Admin (401 / 403).
  - CSRF `X-SF-CSRF` (403).
  - Solo JSON (415).
  - `Idempotency-Key` obligatoria (422). La misma clave con otro contenido devuelve 409.
  - Bitácora `audit_events` (módulo `catalogs`; acciones `category.create`, `category.update`, `category.delete`), visible
    en Usuarios y roles → Bitácora.
- **Cuerpo**: solo `name`, `description` y `status` (`active` / `inactive`); cualquier otro campo da 422.
  - Nombre: obligatorio; se recortan los espacios y se colapsan los dobles; ≤ 255 caracteres, sin caracteres de control.
  - Descripción: ≤ 16,000 caracteres; vacía se guarda como `NULL`.
- **Respuestas de error**:

  | Código | Caso |
  |---|---|
  | 409 `DUPLICATE_CATEGORY` | Nombre repetido, sin distinguir mayúsculas ni acentos. Si la existente está inactiva, el mensaje sugiere reactivarla |
  | 409 `CATEGORY_IN_USE` | Eliminar una categoría con uso |
  | 412 `STALE_VERSION` | La versión enviada en `If-Match` ya no es la vigente |
  | 428 | Falta `If-Match` en edición o eliminación |
  | 404 | Código inexistente o con caracteres inválidos |
- **Versión**: `categories` no tiene columna de versión. Se calcula como los primeros 16 hexadecimales del SHA-256 de
  `[code, name, description, active]` en JSON; cualquier cambio de esos datos la cambia.
- **Concurrencia**: la fila se lee con `FOR UPDATE` dentro de la transacción. El uso (partidas por `category_id` o por la
  misma etiqueta histórica, proveedores y suministros) se revisa en esa misma transacción antes de eliminar; las llaves
  foráneas lo impedirían de todos modos.
- No se modificó el esquema, ni migraciones, ni otras cuentas SQL (contrato 77/52 intacto).

## Permisos SQL añadidos a `supplyflow_catalogwrite_local` (29 → 33)

| Permiso | Tabla | Para qué |
|---|---|---|
| `INSERT` | `categories` | Alta |
| `UPDATE` | `categories` | Edición y estatus |
| `DELETE` | `categories` | Eliminar una categoría nunca usada |
| `SELECT` | `requisition_items` | Contar partidas antes de eliminar |

`docker/supply-catalogwrite/provision.py` agrega solo los permisos que faltan (no borra ni recrea la cuenta, no toca
datos ni esquema) y `verify` exige exactamente los 33.

## Activación en la PC (requiere autorización explícita)

> Ejecuta `provision`, que concede permisos SQL, y recrea solo el contenedor `api`. **Hacer antes un respaldo SQL**
> posterior a INT03. No se ejecutó en tu PC: solo en el sandbox sintético.

- **Si ya activaste el guardado de Clientes, Proveedores y Suministros** (overlay `compose.supply-catalogwrite.yml` y
  secreto `catalogwrite-db-password.txt` existentes):
  1. Ejecutar `provision` para que agregue los 4 permisos nuevos.
  2. Ejecutar `verify`. Debe responder `"result": "PASS"` y `"grants": 33`.
  3. Recrear solo `api`.

  Mientras no se ejecute `provision`, `verify` responde `PRIVILEGES_INCOMPLETE` y el guardado de categorías responde 503,
  pero Clientes, Proveedores y Suministros siguen funcionando.
- **Si nunca se activó**: seguir completa la sección «Activación en la PC» de
  `docs/clientes/ALTA_EDICION_CLIENTES.md`. Esa sección cubre el secreto, el overlay, `provision`, `verify` y la recreación
  de `api`; con este cambio, `verify` debe responder `"grants": 33`.

Los comandos están en esa misma sección; la lista de overlays debe incluir `compose.supply-catalogwrite.yml`.

```powershell
& docker.exe @compose --profile catalogwrite-tools run --rm catalogwrite-db-tools provision
& docker.exe @compose --profile catalogwrite-tools run --rm catalogwrite-db-tools verify
& docker.exe @compose --profile dev up -d --no-deps --force-recreate api
```

**Comprobación**:
1. Crear una categoría de prueba identificable, por ejemplo «Prueba de alta — borrar».
2. Verla en la Matriz de categorías y en la lista de partidas de Registro de requisición.
3. Eliminarla.
4. Revisar las tres acciones en la Bitácora (módulo `catalogs`).

**Reversión**:
- Quitar los 4 permisos con `REVOKE` (con autorización), o quitar el overlay y recrear `api`. En este caso también se
  desactiva el guardado de Clientes, Proveedores y Suministros.
- Las categorías ya creadas permanecen.

## Verificación con datos reales (24 nov 2026)

Se validaron localmente las 12 categorías del respaldo del 9 nov con las reglas reales del servidor (`CategoryInput`). No se
copiaron datos al repositorio.

- **Códigos:** todos tienen formato válido, así que todas se pueden editar y eliminar por su código.
- **Nombre, descripción y estatus:** todos dentro de las reglas.
- **Sin nombres repetidos** (sin distinguir mayúsculas ni acentos).
- **Uso antes de eliminar:**
  - Partidas: se cuentan por vínculo y por etiqueta histórica.
  - Proveedores y suministros: solo por vínculo. Los 415 proveedores con categoría en texto heredado usan etiquetas que no
    coinciden con ninguna de las 12 categorías, así que ninguna se vería «sin uso» por error.
- **Cuenta `catalogwrite` en la PC:** quedó aprovisionada con 33 permisos, incluidos los 4 de Categorías (`verify` → PASS).
- **Pruebas después de los cambios del 24 nov** en el manejo de errores de catálogos: lectura 14/14, escritura 28/28, interfaz
  35/35 y 49/49.

## Pruebas (sandbox sintético, 24 nov 2026)

| Prueba | Resultado | Qué cubre |
|---|---|---|
| `tests/frontend/category_catalog.test.mjs` | 9/9 | Validación, carga útil, mensajes y errores |
| `tests/categories_http_check.py` | 14/14 | Solo lectura, apta para datos reales. Escrituras sin CSRF → 403 y fórmula de la versión |
| `SF_SYNTHETIC_WRITES=1 tests/categories_write_http_check.py` | 28/28 | Ver detalle abajo |
| `tests/frontend/categories_ui_e2e.cjs` | 35/35 | Ver detalle abajo |
| `SF_SYNTHETIC_WRITES=1 tests/frontend/categories_ui_e2e.cjs` | 49/49 | Ver detalle abajo |

- **`categories_write_http_check.py`**:
  - Respuestas 401, 403, 415, 422, 428, 404, 409 y 412.
  - Idempotencia: reintento con la misma clave y misma clave con otro contenido.
  - Duplicados sin distinguir mayúsculas ni acentos.
  - El estatus se refleja en Registro de requisición.
  - Una categoría usada no se elimina.
  - La bitácora registra las operaciones.
  - No quedan categorías de prueba.
- **`categories_ui_e2e.cjs`** (modo lectura): aborta toda escritura y comprueba que la pantalla no da por guardado lo que
  el servidor no confirmó y ofrece Reintentar.
- **`categories_ui_e2e.cjs` con `SF_SYNTHETIC_WRITES=1`**, sobre la categoría sintética de la corrida:
  - Alta con la primera respuesta perdida. Reintentar no duplica (misma clave).
  - Aparece en la lista de partidas sin recargar.
  - Edición a Inactiva y deja de ofrecerse.
  - Versión vencida por un cambio concurrente: no sobrescribe.
  - Eliminación con confirmación por nombre.
  - Bitácora y limpieza final.
  - Las escrituras sobre categorías reales se siguen abortando.
