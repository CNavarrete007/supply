# Usuarios y roles · Segundo Master Admin y cambio de contraseña (25 nov 2026)

## Para qué

Control de cambios (Solicitud / Requisición, tarjeta 6) exige que **otro** Master Admin revise y apruebe o rechace cada
solicitud: el solicitante nunca puede autoaprobarse. En tu base solo una persona tiene contraseña activa, por eso nadie podía
revisar. Ahora un Master Admin puede habilitar a una segunda persona desde SupplyFlow, con trazabilidad completa.

## Qué se habilitó

En **Usuarios y roles → Usuarios → «Actualizar un usuario registrado»** aparece, al elegir a una persona, el panel
**«Acceso y rol Master Admin (MariaDB)»**. Muestra el rol, el estado de la contraseña y el acceso, y ofrece:

| Acción | Cuándo | Qué hace |
|---|---|---|
| **Habilitar como Master Admin** | La persona no es Master Admin | Asigna el rol y habilita el acceso. Si no tiene contraseña, el servidor genera una **temporal** |
| **Restablecer contraseña temporal** | Ya es Master Admin (p. ej. olvidó su contraseña o la temporal venció) | Genera una nueva temporal y cierra sus sesiones abiertas |
| **Retirar Master Admin** | Ya es Master Admin | Quita el rol y cierra sus sesiones. Si no le queda ningún otro rol, deshabilita su acceso |

**Reglas de seguridad (las aplica el servidor):**
- Solo un Master Admin con sesión activa. Nunca sobre **su propia cuenta**: otro Master Admin debe hacerlo.
- **Reautenticación**: escribes **tu** contraseña para confirmar cada acción. Con 5 errores seguidos se bloquea 15 minutos.
- **Motivo** obligatorio (10 a 500 caracteres), que queda en la bitácora.
- Al habilitar, confirmas que es **una persona distinta** de ti. Nunca debe ser una segunda cuenta tuya: eso anularía la
  revisión independiente.
- Solo usuarios **activos**. No se toca a quien se autentica con un proveedor externo.
- Si la ficha cambió mientras la tenías abierta, responde 412: el panel recarga y vuelves a aplicar.
- Reintentar la misma operación no la duplica. La contraseña temporal **no se vuelve a mostrar** en el reintento.
- **Contraseña temporal**:
  - La genera el servidor: 16 caracteres en 4 grupos, letras y números, sin caracteres ambiguos.
  - Se muestra **una sola vez** en el panel, con «Copiar» y «Ya la entregué · ocultar».
  - **Vence en 72 horas.**
  - Se guarda solo como hash Argon2id; nunca en texto, en bitácora ni en registros.
- **Primer inicio de sesión**: con la contraseña temporal no se entra. La pantalla pide **«Elige tu nueva contraseña»**:
  - Mínimo 12 caracteres, con letras y números.
  - No puede contener el usuario ni ser igual a la temporal.
  - Al guardarla entra al sistema, y la temporal deja de servir.
- **«¿Cambiar contraseña?»** en el inicio de sesión permite a cualquier usuario cambiar la suya con su contraseña actual.
- **Bitácora** (Usuarios y roles → Bitácora de actividad, módulo «Usuarios»): `users.access.grant_master_admin`,
  `users.access.reset_password`, `users.access.revoke_master_admin` y `auth.password.change`, con antes/después, motivo y
  sesiones cerradas. Sin contraseñas ni hashes.

**Qué NO hace:**
- No da de alta personas nuevas, ni edita nombres, correos, puestos o estatus.
- No asigna otros roles ni permisos por sección.
- No envía correos: la temporal se entrega en persona o por un canal seguro.

## Servidor

| Método | Ruta | Detalle |
|---|---|---|
| `GET` | `/api/v1/users/access-status` | Diagnóstico de la cuenta (`OK`, `USERADMIN_NOT_PROVISIONED`, `USERADMIN_ACCOUNT_REJECTED`, `USERADMIN_GRANTS_INCOMPLETE`), sin secretos |
| `POST` | `/api/v1/users/{id}/access` | `{action, actor_password, reason}`, con CSRF, JSON, `Idempotency-Key` e `If-Match` (versión del usuario). Lo atiende `UserAccessController` → `UserAccessRepository` |
| `POST` | `/api/v1/auth/password/change` | `{email, current_password, new_password}`, con CSRF y el mismo límite de intentos que el login. Cierra todas las sesiones del usuario |
| `POST` | `/api/v1/auth/login` | Con contraseña temporal responde `409 PASSWORD_CHANGE_REQUIRED` (sin sesión). Si venció, `409 TEMPORARY_PASSWORD_EXPIRED` |

**Cuenta SQL dedicada `supplyflow_useradmin_local`** (overlay `compose.supply-useradmin.yml`, secreto
`useradmin-db-password.txt`, aprovisionador `docker/supply-useradmin/provision.py`). Tiene **18 permisos**: 11 de tabla y
7 de columna.

| Privilegio | Tablas o columnas |
|---|---|
| `SELECT` | `users`, `people`, `roles`, `user_roles`, `auth_sessions`, `idempotency_keys` |
| `INSERT` | `user_roles`, `audit_events`, `idempotency_keys` |
| `UPDATE` (tabla) | `idempotency_keys` |
| `DELETE` | `user_roles` |
| `UPDATE` (columna) | `users`: `password_hash`, `credential_state`, `access_enabled`, `updated_at`, `row_version` |
| `UPDATE` (columna) | `auth_sessions`: `revoked_at`, `revocation_reason` |

No puede cambiar nombres, correos ni estatus.

Las cuentas del contrato 77/52 (api, auth, reqwrite, recovery) **no cambian**. La de catálogos (catalogwrite, 35) tampoco.

## Activación en la PC (requiere tu autorización)

Mismo procedimiento que usaste para la cuenta de catálogos, en **PowerShell** desde `C:\Dev\supply`, con la aplicación en
marcha.

**Paso 1 · Variables, overlays y respaldo.**

```powershell
cd C:\Dev\supply
$root = 'C:\Dev\supply'
$env:SUPPLYFLOW_LOCAL_PRIVATE_DIR = 'C:\Dev\supply-docker-private'
$priv = $env:SUPPLYFLOW_LOCAL_PRIVATE_DIR
$secret = Join-Path $priv 'secrets\useradmin-db-password.txt'
$files = @('docker-compose.yml','compose.supply-db.yml','compose.supply-dev.yml','compose.supply-auth.yml',
           'compose.supply-reqwrite.yml','compose.supply-recovery.yml','compose.supply-dbadmin.yml','compose.supply-catalogwrite.yml')
$compose = @('compose','-p','supply','--project-directory',$root)
foreach ($f in $files) { $compose += @('-f', (Join-Path $root $f)) }
$backup = Join-Path $priv ("backups\antes-useradmin-" + (Get-Date -Format 'yyyyMMdd-HHmm') + ".sql")
& docker.exe @compose exec -T db sh -c 'MYSQL_PWD=$(cat /run/secrets/root_password) mariadb-dump -uroot --single-transaction --routines --triggers --events --default-character-set=utf8mb4 --result-file=/tmp/antes-useradmin.sql supplyflow_dev'
& docker.exe cp supply-db-1:/tmp/antes-useradmin.sql $backup
& docker.exe @compose exec -T db rm -f /tmp/antes-useradmin.sql
Get-Item $backup | Select-Object Name, Length
```

El respaldo debe pesar varios MB. Si es 0 o hay error, **detenerse**.

**Paso 2 · Secreto de la cuenta.** 64 caracteres hexadecimales aleatorios; no se muestra. Se copian los permisos de Windows
de otro secreto.

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
$compose += @('-f', (Join-Path $root 'compose.supply-useradmin.yml'))
& docker.exe @compose --profile dev config --quiet; if ($LASTEXITCODE) { throw 'Compose inválido' }
& docker.exe @compose --profile useradmin-tools run --rm useradmin-db-tools verify
```

**Paso 4 · Crear la cuenta y sus permisos.** Ambos deben responder `"result": "PASS"`, `"grants": 11`, `"column_grants": 7`.

```powershell
& docker.exe @compose --profile useradmin-tools run --rm useradmin-db-tools provision
& docker.exe @compose --profile useradmin-tools run --rm useradmin-db-tools verify
```

**Paso 5 · Recrear solo la API con la cuenta.** Debe quedar `healthy`.

```powershell
& docker.exe @compose --profile dev up -d --no-deps --force-recreate api
& docker.exe @compose ps api
```

**Paso 6 · Comprobar.** Con tu sesión de Master Admin abre `http://localhost:8080/api/v1/users/access-status`. Debe decir
`"code":"OK"` y `"expected_grants":18`.

Desde ahora el arranque normal (`CLAUDE.md`, `SupplyFlow-Restore-INT03.ps1`) agrega `compose.supply-useradmin.yml`
automáticamente si existe su secreto.

## Uso: habilitar al segundo Master Admin

1. Elige a la **persona** que revisará los cambios. Debe estar registrada y activa en Usuarios y roles, y ser alguien distinto
   de ti.
2. Ve a **Usuarios y roles → Usuarios** y selecciónala en «Actualizar un usuario registrado».
3. En «Acceso y rol Master Admin» elige **Habilitar como Master Admin**, escribe el motivo y tu contraseña, marca la
   confirmación y pulsa **Aplicar**.
4. Copia la **contraseña temporal** y entrégasela en persona o por un canal seguro. Pulsa «Ya la entregué · ocultar». Vence en
   72 horas; si vence, usa «Restablecer contraseña temporal».
5. Esa persona inicia sesión con su correo y la temporal, elige su contraseña definitiva y entra.
6. Ya puede **REVISAR** en Solicitud / Requisición → Control de cambios las solicitudes que tú registres, y tú las de ella.

## Pruebas

| Prueba | Tipo | Resultado (sandbox sintético) |
|---|---|---|
| `tests/user_access_http_check.py` | HTTP, **escribe** (`SF_SYNTHETIC_WRITES=1`, objetivo sintético `qa.reviewer.c`) | 34/34 (dos corridas seguidas) |
| `tests/frontend/user_access_ui_e2e.cjs` | Navegador, **escribe**: panel, temporal, primer acceso, Control de cambios, retiro | 18/18 (dos corridas seguidas) |
| `tests/useradmin_contract_check.py` | Contrato de permisos PHP ↔ `provision.py` | 6/6 |
| `tests/frontend/user_access_model.test.mjs` | Lógica pura | 4/4 |
| Vencimiento de la temporal (simulado en el sandbox, 73 h) | Manual | `TEMPORARY_PASSWORD_EXPIRED` en login y en cambio |

## Limitaciones

- La revisión independiente depende de que la segunda cuenta sea **de otra persona**. SupplyFlow no puede comprobarlo; por eso
  se pide la confirmación y queda en la bitácora.
- La contraseña temporal se entrega fuera de SupplyFlow (no hay envío de correos).
- Las requisiciones **editadas en Registro o regularizadas** siguen sin poder aprobarse en Control de cambios
  (`SNAPSHOT_NUMBER_OCCUPIED`). Es la opción B, pendiente de tu decisión.
