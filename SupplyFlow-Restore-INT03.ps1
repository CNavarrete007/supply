<#
.SYNOPSIS
  SupplyFlow INT03 - Traslado fiel a otra PC: inspeccion, restauracion controlada y arranque.

.DESCRIPTION
  Fases (ejecutar en orden; cada una se detiene ante cualquier anomalia):
    Inspect  SOLO LECTURA. Docker/Compose, directorio privado, secretos (sin mostrarlos),
             composicion de 7 archivos, volumen existente y analisis del respaldo SQL.
    Restore  Requiere -Confirmar. Solo si NO existe el volumen de base de datos del proyecto:
             levanta db, restaura backups\<Dump> en una base vacia y crea las 4 cuentas SQL
             con el contrato 77/52 (docker/supply-int03). Nunca sobrescribe una base existente.
    Start    Verifica cuentas 77/52 y levanta api/frontend/web con los 7 archivos Compose;
             comprueba health 200, ready 200 y 401 sin sesion.

  No ejecuta migraciones R3, ni Provision RF1 (38/74), ni auth_tool (74/17), ni comandos
  destructivos (down -v, volume rm, prune). Toda la logica SQL corre en contenedores sin red.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\SupplyFlow-Restore-INT03.ps1 -Phase Inspect
  powershell -ExecutionPolicy Bypass -File .\SupplyFlow-Restore-INT03.ps1 -Phase Restore -Confirmar
  powershell -ExecutionPolicy Bypass -File .\SupplyFlow-Restore-INT03.ps1 -Phase Start
#>
[CmdletBinding()]
param(
  [ValidateSet('Inspect', 'Restore', 'Start')][string]$Phase = 'Inspect',
  [string]$Root = $PSScriptRoot,
  [string]$PrivateDir = 'C:\Dev\supply-docker-private',
  [string]$Dump = 'supplyflow_dev.sql',
  [string]$Project = 'supply',
  [switch]$Confirmar
)
# Native tools write progress to stderr; never convert it into terminating errors (PS 5.1).
$ErrorActionPreference = 'Continue'
$ImportHash = 'cd9a8d0eb37b7c461cc1a269f7eb554d89fd76040963d539e4c3f6fbd8754619'
$Secrets = @('mariadb-root.txt', 'api-db-password.txt', 'auth-db-password.txt', 'reqwrite-db-password.txt', 'recovery-db-password.txt')
$Files = @('docker-compose.yml', 'compose.supply-db.yml', 'compose.supply-dev.yml', 'compose.supply-auth.yml',
  'compose.supply-reqwrite.yml', 'compose.supply-recovery.yml', 'compose.supply-dbadmin.yml')
$script:Problems = New-Object System.Collections.Generic.List[string]

function Say([string]$Status, [string]$Text) { Write-Host ('[{0,-7}] {1}' -f $Status, $Text) }
function Fail([string]$Text) { $script:Problems.Add($Text); Say 'BLOCKED' $Text }
function Stop-Blocked([string]$Text) { Say 'BLOCKED' $Text; Write-Host 'Detenido sin cambios adicionales. Comparte esta salida.'; exit 1 }

if (-not $Root) { $Root = (Get-Location).Path }
$env:SUPPLYFLOW_LOCAL_PRIVATE_DIR = $PrivateDir
$Compose = @('compose', '-p', $Project, '--project-directory', $Root)
foreach ($f in $Files) { $Compose += @('-f', (Join-Path $Root $f)) }

function Invoke-Json([string[]]$Arguments) {
  $lines = & docker @Compose @Arguments
  $code = $LASTEXITCODE
  $text = ($lines | Where-Object { $_ -ne $null }) -join "`n"
  $json = $null
  try { $json = $text | ConvertFrom-Json } catch { $json = $null }
  return @{ Code = $code; Json = $json; Text = $text }
}

function Test-Prereqs([bool]$NeedDump) {
  Say 'INFO' "Comprobaciones previas (solo lectura) - proyecto '$Project' - raiz $Root - privado $PrivateDir"
  $null = & docker info --format '{{.OSType}}'
  if ($LASTEXITCODE -ne 0) { Stop-Blocked 'Docker Desktop no esta en ejecucion.' }
  $os = (& docker info --format '{{.OSType}}')
  if ($os -ne 'linux') { Fail "Docker debe usar contenedores Linux (actual: $os)." }
  $ver = (& docker compose version --short) -replace '^v', ''
  try { if ([version]$ver -lt [version]'2.24.4') { Fail "Docker Compose $ver < 2.24.4 (se requiere !override)." } else { Say 'OK' "Docker Compose $ver" } }
  catch { Fail "No se pudo leer la version de Docker Compose ($ver)." }

  foreach ($f in $Files) { if (-not (Test-Path -LiteralPath (Join-Path $Root $f) -PathType Leaf)) { Fail "Falta $f en $Root" } }
  # Secrets must live OUTSIDE the project: the legacy docker-compose.yml serves the whole project folder.
  $sep = [IO.Path]::DirectorySeparatorChar
  $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/') + $sep
  $privFull = [IO.Path]::GetFullPath($PrivateDir).TrimEnd('\', '/') + $sep
  if ($privFull.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
    Fail "El directorio privado esta DENTRO del proyecto ($PrivateDir). Muevelo fuera, p. ej. C:\Dev\supply-docker-private."
    return $false
  }
  if (-not (Test-Path -LiteralPath $PrivateDir -PathType Container)) { Fail "No existe el directorio privado $PrivateDir."; return $false }
  foreach ($s in $Secrets) {
    $p = Join-Path (Join-Path $PrivateDir 'secrets') $s
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { Fail "Falta secrets\$s"; continue }
    $bytes = [IO.File]::ReadAllBytes($p)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { Fail "secrets\$s tiene BOM UTF-8 (la API lo rechazaria)."; continue }
    $value = [Text.Encoding]::ASCII.GetString($bytes).Trim()
    if ($value -cnotmatch '^[a-f0-9]{64}$') { Fail "secrets\$s no tiene el formato esperado (64 hex). Su contenido no se muestra." }
    else { Say 'OK' "secrets\$s presente y con formato valido" }
  }
  $imports = Join-Path $PrivateDir "imports\$ImportHash\files"
  if (Test-Path -LiteralPath $imports -PathType Container) { Say 'OK' 'imports\...\files presente' } else { Fail 'Falta imports\<hash>\files (requerido por compose.supply-recovery.yml).' }
  if (Test-Path -LiteralPath (Join-Path $PrivateDir 'evidence') -PathType Container) { Say 'OK' 'evidence presente' } else { Fail 'Falta la carpeta evidence.' }
  $dumpPath = Join-Path (Join-Path $PrivateDir 'backups') $Dump
  if ($NeedDump -and -not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) { Fail "No existe backups\$Dump en $PrivateDir (mueve ahi el respaldo; no lo dejes en el proyecto)." }
  if (Test-Path -LiteralPath (Join-Path $Root $Dump)) { Fail "El respaldo sigue dentro del proyecto ($Root\$Dump). Muevelo a $PrivateDir\backups." }
  if ($script:Problems.Count) { return $false }

  $null = & docker @Compose --profile dev config --quiet
  if ($LASTEXITCODE -ne 0) { Fail 'La composicion de 7 archivos no es valida.'; return $false }
  Say 'OK' 'Composicion de 7 archivos valida'
  $db = & docker ps -a --filter "label=com.docker.compose.project=$Project" --filter 'label=com.docker.compose.service=db' --format '{{.Names}} {{.State}}'
  if ($db) { Say 'INFO' "Contenedor de base existente: $db" }
  $vol = & docker volume ls -q --filter "name=^${Project}_supplyflow_db_data$"
  if ($vol) { Say 'INFO' "Volumen de base existente: $vol" } else { Say 'INFO' 'No existe volumen de base de datos' }
  return [bool]$true
}

function Test-Inspect {
  if (-not (Test-Prereqs $true)) { return $false }
  $db = & docker ps -a --filter "label=com.docker.compose.project=$Project" --filter 'label=com.docker.compose.service=db' --format '{{.State}}'
  if ($db -and $db -ne 'running') { Fail "Existe un contenedor db detenido o fallido ($db) de un intento anterior. Revisalo antes de restaurar (no se borra automaticamente)." }
  $vol = & docker volume ls -q --filter "name=^${Project}_supplyflow_db_data$"
  if ($vol) { Fail "Ya existe el volumen $vol. Restore solo se ejecuta sin volumen de base (no se restaura encima)." }
  if (-not $db -and -not $vol) { Say 'OK' 'Sin contenedor ni volumen de base: se puede restaurar en limpio' }

  Say 'INFO' 'Analizando el respaldo (solo estructura; puede construir la imagen de herramientas la primera vez)...'
  $r = Invoke-Json @('--profile', 'int03-tools', 'run', '--rm', 'int03-dump-inspect', "/backups/$Dump")
  if (-not $r.Json) { Fail "No se pudo analizar el respaldo. Salida: $($r.Text)"; return $false }
  $d = $r.Json
  Say 'INFO' ("Respaldo: {0:N0} bytes - SHA-256 {1}" -f $d.size_bytes, $d.sha256)
  Say 'INFO' ("Codificacion {0} - tablas {1} - INSERT {2} - completo {3}" -f $d.encoding, $d.tables, $d.counts.insert_statements, $d.completed_marker)
  if ($d.header) { $d.header | ForEach-Object { Say 'INFO' $_ } }
  if ($d.result -ne 'PASS') { Fail ('Respaldo no apto: ' + (($d.reasons) -join ', ')); return $false }
  Say 'OK' 'Respaldo apto: 77 tablas, R3C1-HF2/R3C2/R3C3, UTF-8, completo, sin cuentas SQL'
  if ($script:Problems.Count) { return $false }
  return [bool]$true
}

function Wait-DbHealthy {
  for ($i = 0; $i -lt 90; $i++) {
    $id = & docker @Compose ps -q db | Select-Object -First 1
    if ($id) {
      $h = & docker inspect -f '{{.State.Health.Status}}' $id
      if ($h -eq 'healthy') { Say 'OK' 'MariaDB healthy'; return }
    }
    Start-Sleep -Seconds 2
  }
  Stop-Blocked 'MariaDB no llego a healthy en 3 minutos.'
}

function Get-Status([string]$Url) {
  try { return [int](Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15).StatusCode }
  catch { if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }; return 0 }
}

switch ($Phase) {
  'Inspect' {
    if (Test-Inspect) { Say 'PASS' 'Inspect completo. Siguiente: -Phase Restore -Confirmar (solo si no existe volumen de base).'; exit 0 }
    Write-Host "Problemas: $($script:Problems.Count)"; exit 1
  }
  'Restore' {
    if (-not $Confirmar) { Stop-Blocked 'Restore requiere -Confirmar.' }
    if (-not (Test-Inspect)) { Stop-Blocked 'Inspect no paso.' }
    $vol = & docker volume ls -q --filter "name=^${Project}_supplyflow_db_data$"
    if ($vol) { Stop-Blocked "Ya existe $vol. No se restaura encima de una base existente." }
    & docker @Compose up -d db
    if ($LASTEXITCODE -ne 0) { Stop-Blocked 'No se pudo iniciar db.' }
    Wait-DbHealthy
    $r = Invoke-Json @('--profile', 'int03-tools', 'run', '--rm', 'int03-restore-tools', $Dump)
    Say 'INFO' $r.Text
    if (-not $r.Json -or $r.Json.result -ne 'PASS') { Stop-Blocked 'La restauracion no termino en PASS. No reintentes; comparte esta salida.' }
    $a = Invoke-Json @('--profile', 'int03-tools', 'run', '--rm', 'int03-accounts-tools', 'provision')
    if (-not $a.Json -or $a.Json.result -ne 'PASS') { Say 'INFO' $a.Text; Stop-Blocked 'Las cuentas SQL no quedaron conformes al contrato 77/52.' }
    $a.Json.accounts.PSObject.Properties | ForEach-Object { Say 'OK' ('{0}: tabla {1}/{2} - columna {3}/{4} - esquema {5}' -f $_.Name, $_.Value.table_grants, $_.Value.expected_table_grants, $_.Value.column_grants, $_.Value.expected_column_grants, ($_.Value.schema_grants -join ',')) }
    $a.Json.schema.row_counts.PSObject.Properties | ForEach-Object { Say 'INFO' ('filas {0}: {1}' -f $_.Name, $_.Value) }
    Say 'PASS' 'Base restaurada y cuentas 77/52 verificadas. Siguiente: -Phase Start'
    exit 0
  }
  'Start' {
    if (-not (Test-Prereqs $false)) { Stop-Blocked 'Comprobaciones previas no pasaron; no se levanta ningun contenedor.' }
    $vol = & docker volume ls -q --filter "name=^${Project}_supplyflow_db_data$"
    if (-not $vol) { Stop-Blocked 'No existe base restaurada. Ejecuta primero -Phase Inspect y -Phase Restore -Confirmar.' }
    $null = & docker @Compose up -d db
    if ($LASTEXITCODE -ne 0) { Stop-Blocked 'No se pudo iniciar db.' }
    Wait-DbHealthy
    $a = Invoke-Json @('--profile', 'int03-tools', 'run', '--rm', 'int03-accounts-tools', 'verify')
    if (-not $a.Json -or $a.Json.result -ne 'PASS') { Say 'INFO' $a.Text; Stop-Blocked 'La base/cuentas no cumplen 77/52. No se levanta la aplicacion.' }
    Say 'OK' 'Base 77 tablas y cuentas 52/27/10+2 verificadas'
    Say 'INFO' 'Levantando api, frontend y web (la primera vez npm ci puede tardar varios minutos)...'
    & docker @Compose --profile dev up -d --build api frontend web
    if ($LASTEXITCODE -ne 0) { Stop-Blocked 'docker compose up fallo. Revisa: docker compose ps -a y logs del servicio.' }
    $checks = @(@('http://localhost:8080/api/v1/health', 200), @('http://localhost:8080/api/v1/ready', 200), @('http://localhost:8080/api/v1/recovery/catalogs', 401))
    $ok = $true
    foreach ($c in $checks) {
      $s = 0; for ($i = 0; $i -lt 30 -and $s -ne $c[1]; $i++) { $s = Get-Status $c[0]; if ($s -ne $c[1]) { Start-Sleep -Seconds 3 } }
      if ($s -eq $c[1]) { Say 'OK' "$($c[0]) -> $s" } else { Say 'BLOCKED' "$($c[0]) -> $s (esperado $($c[1]))"; $ok = $false }
    }
    & docker @Compose ps -a
    if ($ok) { Say 'PASS' 'SupplyFlow en http://localhost:8080 (inicia sesion con tu usuario de la PC anterior).'; exit 0 }
    exit 1
  }
}
