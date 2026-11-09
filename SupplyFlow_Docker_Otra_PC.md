# SupplyFlow — Guía breve para arrancar en otra PC con Windows

**Base revisada:** `supply (2).zip`, 9 noviembre 2026. Este ZIP contiene código, **NO** la base MariaDB ni contraseñas/importaciones.

## Qué necesitas además del ZIP

1. **Docker Desktop para Windows**, usando contenedores Linux/WSL2, Compose moderno (`!override` requiere >=2.24.4).
2. Extraer `supply/` a `C:\Dev\supply`. El Dockerfile del frontend instala npm desde `package-lock.json` en un volumen Docker; no necesitas `node_modules` en el ZIP.
3. Crear/trasladar de forma segura `C:\Dev\supply-docker-private` **fuera del proyecto**. Debe contener contraseñas privadas, `evidence/` y el montaje de documentos de `imports/.../files`. **Nunca** agregar secretos al ZIP o a Git.
4. **Si deseas conservar usuarios, clientes y requisiciones:** obtener respaldo SQL consistente **posterior** a la operación INT03, y verificar restauración de datos + permisos SQL (77 tablas/52 grants). El ZIP solo tiene el esquema fuente y tres migraciones, no los datos. No arrastres el volumen MySQL activo de la PC anterior.
5. Comprobar el esquema y las cuentas SQL. `docker/supply-recovery/provision.py` sigue ligado al contrato RF1 antiguo de 74/38: no ejecutarlo a ciegas sobre el esquema actualizado 77/52. Si usas contraseñas nuevas, alinear cuentas SQL con archivos secretos. El overlay `compose.supply-recovery.yml` tiene una ruta de `imports` específica.

## Primera comprobación segura, antes de arrancar contenedores

Abre Docker Desktop y espera a que diga que está en ejecución. En PowerShell:

```powershell
docker version
docker compose version
docker info --format 'Server={{.ServerVersion}} OS={{.OSType}}'
```

Luego, después de preparar los archivos del punto anterior, configura la composición completa:

```powershell
$root='C:\Dev\supply'
$env:SUPPLYFLOW_LOCAL_PRIVATE_DIR='C:\Dev\supply-docker-private'
$files=@('docker-compose.yml','compose.supply-db.yml','compose.supply-dev.yml',
  'compose.supply-auth.yml','compose.supply-reqwrite.yml',
  'compose.supply-recovery.yml','compose.supply-dbadmin.yml')
$compose=@('compose','-p','supply','--project-directory',$root)
foreach($f in $files) {
  $p=Join-Path $root $f
  if(-not(Test-Path -LiteralPath $p -PathType Leaf)) { throw "Falta: $p" }
  $compose+=@('-f',$p)
}
& docker.exe @compose --profile dev config --quiet
if($LASTEXITCODE -ne 0){throw 'La configuracion Compose aun no esta lista'}
```

**Importante:** `config --quiet` valida sintaxis/combinación de YAML y ciertas variables; no demuestra que el contenido SQL y los secretos sean correctos.

## Arranque — solo cuando restauración y cuentas estén listas

```powershell
& docker.exe @compose --profile dev up -d --build db api frontend web
& docker.exe @compose --profile dev --profile db-admin up -d phpmyadmin
& docker.exe @compose ps -a
```

Comprobar `http://localhost:8080`, `http://localhost:8080/api/v1/health`, `http://localhost:8080/api/v1/ready`, y que `/api/v1/recovery/catalogs` sin autenticación responda **401**, no 200 ni 503. phpMyAdmin opcional en `http://localhost:8081`.

**No uses** `docker-compose.yml` solo: es un Compose heredado con web estático; la API actual requiere overlays `auth`, `reqwrite`, `recovery`. No uses `docker compose down -v` ni borres volúmenes. No repitas la migración INT03 ni `Provision` RF1 de 38 permisos sobre base de 77/52.

## Si no cuentas aún con la base SQL o los secretos

Detente después de comprobar Docker. Claude Code debe preparar un plan de **instalación nueva vacía con datos sintéticos** o **traslado fiel de la PC anterior**, y explicar qué insumo falta. No inventar usuarios, datos comerciales ni una restauración que no ocurrió.
