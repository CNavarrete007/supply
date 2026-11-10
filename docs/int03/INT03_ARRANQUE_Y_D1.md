# SupplyFlow · INT03 — Arranque seguro en Docker (Windows) e INT03-D1 Regularización

Fecha: 9 nov 2026 · Entorno: **desarrollo local**, no producción.

## 1. Hechos verificados en el código (no en la narración histórica)

| Elemento | Estado observado |
|---|---|
| Compose | 7 archivos superpuestos. `docker-compose.yml` solo es un Nginx estático heredado; **no** usarlo solo. |
| `compose.supply-db.yml` | MariaDB 11.8.9 (digest fijo), volúmenes `supplyflow_db_data` y `supplyflow_db_socket`; secreto `secrets/mariadb-root.txt`. Herramienta `db-tools` (perfil `tools`) monta `evidence/`. |
| `compose.supply-dev.yml` | Perfil `dev`: `web` (Nginx 127.0.0.1:8080), `frontend` (Node 24, `npm ci` en volumen), `api` (PHP 8.4 + CI 4.7.5, usuario `supplyflow_api_local`, secreto `api-db-password.txt`). `!override` exige Compose ≥ 2.24.4. |
| `compose.supply-auth.yml` | Agrega a `api` la cuenta `supplyflow_auth_local` + `auth-db-password.txt`. Sin él, login no funciona. |
| `compose.supply-reqwrite.yml` | Agrega `supplyflow_reqwrite_local` + `reqwrite-db-password.txt` (borradores v0.7). |
| `compose.supply-recovery.yml` | Agrega `supplyflow_recovery_local` + `recovery-db-password.txt`, `transport.ini` (12M/8M), **reemplaza la config de Nginx** por `docker/supply-recovery/nginx.conf` y monta **obligatoriamente** `imports/cd9a8d0e…4619/files` (debe existir aunque esté vacío, `create_host_path: false`). |
| `compose.supply-dbadmin.yml` | phpMyAdmin opcional, perfil `db-admin`, 127.0.0.1:8081, login manual. |
| Permisos SQL | `docker/supply-recovery/provision.py` define solo el contrato antiguo **38/74**. El contrato **52/77** aplicado en INT03 **no está versionado en el repositorio** (solo documentado en `R3*_NOTAS.md`). `auth_tool.py` exige exactamente 74 tablas y 17 usuarios importados: no sirve para una base nueva ni para una de 77. |
| Credenciales en código | `api`/`auth`/`recovery` exigen secretos de **64 hex** en `/run/secrets/*` y host `db`; la cuenta recovery debe llamarse exactamente `supplyflow_recovery_local`. |

## 2. Qué falta en ESTA computadora (contenedor de nube de Claude Code)

Aquí solo existe el código del repositorio. **No existen**: directorio privado `SUPPLYFLOW_LOCAL_PRIVATE_DIR`, los 5 secretos, respaldo SQL (ni previo ni posterior a INT03), volumen `supply_supplyflow_db_data`, documentos importados (`imports/…/files`), `evidence/`, ni los usuarios/grants del esquema `mysql`. Por tanto **no se trasladó ni se probó ningún dato real**. Todas las pruebas de este incremento usaron una base **sintética desechable** (ver §5).

En tu nueva PC Windows, comprueba los insumos **sin leer su contenido**:

```powershell
$p = 'C:\Dev\supply-docker-private'
'secrets\mariadb-root.txt','secrets\api-db-password.txt','secrets\auth-db-password.txt',
'secrets\reqwrite-db-password.txt','secrets\recovery-db-password.txt','evidence',
'imports\cd9a8d0eb37b7c461cc1a269f7eb554d89fd76040963d539e4c3f6fbd8754619\files' |
  ForEach-Object { '{0,-6} {1}' -f (Test-Path -LiteralPath (Join-Path $p $_)), $_ }
docker volume ls --filter name=supply
```

## 3. Dos caminos distintos

### A. Traslado fiel de la PC anterior (conserva usuarios, clientes, requisiciones) — AUTOMATIZADO
Herramientas versionadas (perfil Compose `int03-tools`, contenedores **sin red**, socket local):

| Servicio | Archivo | Qué hace |
|---|---|---|
| `int03-dump-inspect` | `docker/supply-int03/dump_inspect.py` | Solo lectura: SHA-256, codificación (bloquea UTF-16), 77 tablas, R3C1-HF2/R3C2/R3C3, marcador de volcado completo, sin cuentas SQL. No imprime datos. |
| `int03-restore-tools` | `docker/supply-int03/restore.sh` | Misma imagen fijada de MariaDB; restaura `backups\<archivo>.sql` (montado en solo lectura) **solo si `supplyflow_dev` no existe**; verifica 77 tablas. Sin copias temporales. |
| `int03-accounts-tools` | `docker/supply-int03/accounts.py` | `inspect` / `provision` / `verify` de las 4 cuentas con contrato 77/52 (api SELECT de esquema, auth 10+2, reqwrite 27, recovery 52). Solo crea lo que falta; se detiene si hay otra contraseña, otro host o permisos de más. Sustituye a `auth_tool.py` (74/17) y `Provision` RF1 (38/74) para bases de 77 tablas. |

Procedimiento en Windows (desde `C:\Dev\supply`):
1. Mover el respaldo a `C:\Dev\supply-docker-private\backups\supplyflow_dev.sql` (fuera del proyecto).
2. `powershell -ExecutionPolicy Bypass -File .\SupplyFlow-Restore-INT03.ps1 -Phase Inspect` (solo lectura).
3. `... -Phase Restore -Confirmar` → levanta solo `db` en volumen vacío, restaura, crea cuentas y verifica 77/52.
4. `... -Phase Start` → verifica 77/52, levanta `api frontend web` con los 7 archivos y comprueba 200/200/401.

**Respaldos exportados con phpMyAdmin (10 nov 2026, comprobado):** phpMyAdmin 5.2.3 sobre MariaDB 11.8.9 conserva columnas, índices, 256 llaves foráneas y las 64 validaciones JSON, pero **omite las 55 restricciones CHECK con nombre** (y la opción explícita `row_format=DYNAMIC`, que es el valor por defecto). `restore.sh` restaura el respaldo, construye una referencia vacía y temporal desde el DDL versionado, exige estructura idéntica, repone las 55 CHECK (incluida R3C1-HF2) validándolas contra los datos y elimina la referencia. Si un dato no cumple una regla, se detiene nombrándola sin modificar datos, y `accounts.py` se niega a continuar (exige 55 CHECK y 256 llaves). Prueba: respaldo phpMyAdmin real → restauración PASS con CHECKSUM TABLE idéntico 77/77 al origen; respaldo con un estado inválido → `FAILED ck_users_credential`. Para respaldos futuros preferir `mariadb-dump` ejecutado dentro del contenedor `db` (no con redirección `>` de PowerShell 5.1, que produce UTF-16).

Si solo existe un respaldo **previo** a INT03 (74 tablas), el inspector lo bloquea: requiere migrar una única vez con autorización, no este flujo.

Validación (9 nov 2026, entorno de nube con Docker real y la composición de 7 archivos, datos sintéticos): PC anterior simulada con esquema + 3 migraciones + `mariadb-dump` 11.8.9 → inspector PASS (y BLOCKED para UTF-16, truncado y 74 tablas) → restauración en proyecto `supply` vacío PASS, segunda restauración BLOCKED → cuentas 52/27/10+2 CREATED, repetición EXISTING_VERIFIED, permiso extra o contraseña distinta BLOCKED → **CHECKSUM TABLE idéntico 77/77** → API y UI sobre la base restaurada: HTTP 35/35, UI 24/24. No ejecutado aquí: el script `.ps1` en sí (sin PowerShell en este entorno; sus comandos equivalentes sí) y la compilación de las imágenes `api`/`frontend` (red de la nube sin Debian/getcomposer).

### B. Instalación nueva con datos sintéticos (para desarrollo sin datos de clientes)
Base vacía → `01_schema.sql` + 3 migraciones → cuentas mínimas (incluido el contrato 52) → semilla ficticia. Es exactamente lo que automatiza el arnés `tests/int03d1/sandbox_sql.py` (solo para bases vacías y desechables). Nunca mezclarlo con la base comercial.

## 4. Procedimiento de arranque (PowerShell, PC nueva)

1. Docker Desktop (motor Linux/WSL2) en ejecución: `docker version`, `docker compose version` (≥ 2.24.4).
2. Código en `C:\Dev\supply`; privados en `C:\Dev\supply-docker-private` (§2 todo en `True`).
3. Validar composición completa (no arranca nada):
```powershell
$root='C:\Dev\supply'; $env:SUPPLYFLOW_LOCAL_PRIVATE_DIR='C:\Dev\supply-docker-private'
$compose=@('compose','-p','supply','--project-directory',$root)
foreach($f in 'docker-compose.yml','compose.supply-db.yml','compose.supply-dev.yml','compose.supply-auth.yml',
  'compose.supply-reqwrite.yml','compose.supply-recovery.yml','compose.supply-dbadmin.yml'){ $compose+=@('-f',(Join-Path $root $f)) }
& docker.exe @compose --profile dev config --quiet; if($LASTEXITCODE){throw 'BLOCKED'}
```
4. Solo la base (camino A: restaurar aquí; camino B: instalar esquema sintético aquí): `& docker.exe @compose up -d db`
5. Verificar cuentas (script SQL de solo lectura). Si no da 77/52, **detenerse**.
6. Aplicación: `& docker.exe @compose --profile dev up -d --build api frontend web` (siempre con **los 7 archivos**: recrear `api` sin `auth`/`reqwrite` fue la causa del BLOCKED de INT03).
7. Comprobar: `http://localhost:8080/api/v1/health` 200 · `/api/v1/ready` 200 · `/api/v1/recovery/catalogs` sin sesión **401** · `http://localhost:8080` login.
8. Opcional: `& docker.exe @compose --profile dev --profile db-admin up -d phpmyadmin` (127.0.0.1:8081).

Prohibido: `down -v`, `volume rm/prune`, `system prune`, mover el volumen crudo, repetir migraciones/`Provision` RF1 sobre 77/52.

## 5. INT03-D1 · Sin requisición / Regularización (implementado)

**Contrato R2 real** (derivado de `RequisitionRecoveryController`, `RequisitionRegularizationInput`, `RequisitionRecoveryRepository`; backend **sin cambios**):
- `GET /api/v1/recovery/matrix` → filas con `is_provisional`, `regularization_status|requirement|due_date|owner_snapshot`, `provisional_folio`, `version`, `restriction`.
- `GET …/requisitions/{id}/regularization` → `{is_provisional,status,version,regularization}`.
- `POST …/requisitions/{id}/regularization` → JSON `{method,date,reference,notes,evidence:{name,data}|null}`; cabeceras `X-SF-CSRF`, `Idempotency-Key` (UUID), `If-Match: "N"`. Métodos: formal, po, email, portal, contract, management, emergency, other. Evidencia PDF/PNG/JPEG/WebP ≤ 8 MiB, obligatoria salvo `contract`. Solo Master Admin **creador** del expediente RF1; históricos importados → 409.
- `GET …/regularization/document` → descarga `attachment`, `no-store`, verificación SHA-256.
- Errores: 401, 403 (`FORBIDDEN`/`CSRF_INVALID`), 404, 412 `STALE_VERSION`, 409 (`READ_ONLY_RECORD`, `NOT_PENDING_REGULARIZATION`, `IDEMPOTENCY_CONFLICT`, `BUSY`), 413, 415, 422, 428, 503.

**Frontend:** `src/views/recovery/Regularization.jsx` (nuevo), helpers puros en `model.mjs`, cliente en `api.js`, enlace en `RequisitionRecovery.jsx` (las otras 5 tarjetas y el arreglo `alive` intactos). KPIs (total / en plazo / vencidas / regularizadas), búsqueda, filtro, modal con resumen, formulario, evidencia inicial y de regularización, estado regularizado de solo lectura. La clave de idempotencia y el contenido se **retienen** ante resultados inciertos (5xx/red/CSRF/BUSY) para reintentar sin duplicar; 412/409 recargan la versión vigente.

### Pruebas ejecutadas (base sintética: MariaDB 11.8.9 en Docker, 77 tablas, recovery 52 grants)
| Prueba | Resultado |
|---|---|
| `python3 -I tests/int03d1/r2_http_e2e.py` (HTTP real contra la API) | **35/35 PASS** |
| `node --test tests/int03d1/regularization_model.test.mjs` | **8/8 PASS** |
| `node tests/int03d1/ui_regularization_e2e.cjs` (Chromium + Vite + API + MariaDB) | **24/24 PASS** |
| `vite build` | OK |

Diferencias del entorno de prueba respecto a tu Docker Desktop (declaradas): imagen MariaDB `mirror.gcr.io/library/mariadb:11.8.9` (Docker Hub devolvió 429; digest distinto al fijado), API con PHP 8.3 del host y Vite con Node 22 (no las imágenes PHP 8.4/Node 24), proxy de Vite en lugar de Nginx. **No** constituye prueba en tu PC ni con datos reales.

### Reproducir en un entorno sintético
```bash
python3 -I tests/int03d1/sandbox_sql.py accounts <dir-secretos>   # SQL de cuentas (incluye contrato 52)
python3 -I tests/int03d1/sandbox_sql.py seed <hashes.json>         # organización/usuarios/clientes ficticios
SF_BASE=http://127.0.0.1:8090 SF_QA_PASSWORD=... python3 -I tests/int03d1/r2_http_e2e.py
npx vite --config tests/int03d1/vite.sandbox.config.mjs
SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... node tests/int03d1/ui_regularization_e2e.cjs
```

### Limitaciones
- DOC/DOCX no admitidos (el backend R2 los rechaza deliberadamente).
- La matriz no expone “creador”; el botón se ofrece en provisionales no importados y el servidor decide (409 con mensaje claro).
- Vencimiento calculado con la fecha local del navegador; la zona de negocio sigue “por confirmar” en el esquema.
- Etiquetas en español de los 8 métodos: redactadas a partir de los códigos del backend; validar contra el Apps Script original cuando esté disponible.

## 6. Siguiente: INT03-D2 (Control de cambios R3A/R3B/R3C1) e INT03-D3 (R3C2/R3C3 solo lectura)
D2: lista `GET /recovery/changes`, alta `POST /requisitions/{id}/changes`, retiro, cola `review-queue`, `review` y `decision` por **administrador distinto** (requiere 2 usuarios sintéticos; ya existen en el arnés), alta de partidas R3C1. D3: `impact`, `commercial-reconciliation` y `commercial-executions` **GET**; los POST comerciales permanecen deshabilitados en la UI.
