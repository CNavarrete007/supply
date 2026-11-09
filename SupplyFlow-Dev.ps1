#requires -Version 5.1
<#
.SYNOPSIS
  Prepara, inicia y verifica React + API + Nginx sobre la BD LOCAL ya validada.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\SupplyFlow-Dev.ps1 -Action Start
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\SupplyFlow-Dev.ps1 -Action Verify
.NOTES
  Sintaxis compatible con Windows PowerShell 5.1 y PowerShell 7.
  Requiere la BD del kit 0.1/HF1. La evidencia historica es opcional.
  Conserva el secreto root, el contenedor db y su volumen.
  Prepare valida el esquema y provisiona una cuenta API con SELECT solamente.
  Start incluye Prepare, inicia api/frontend/web y verifica HTTP + SQL.
  Verify comprueba el stack existente. Status solo consulta el estado.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Prepare', 'Start', 'Verify', 'Status')]
    [string]$Action = 'Status',
    [string]$ProjectPath,
    [string]$PrivatePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ExpectedSchemaHash = '2592455e38491b644b0f2c734eadf3aa33db5ccdc57dbfa54229f616be4056e5'
$script:ExpectedStructure = 'd01df78964032449733773e52b0564f6e92f2e5c5ff3c3f5de40550052baea5e'
$script:ToolsBuilt = $false
$script:SecretCreated = $false
$script:LockStream = $null
$script:EvidenceDirectory = $null
$script:LastToolStartedUtc = $null
$script:BeforeDatabase = $null
$script:HistoricalPersistencePresent = $false
$script:IsWindowsHost = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
$script:PathComparison = [StringComparison]::Ordinal
if ($script:IsWindowsHost) { $script:PathComparison = [StringComparison]::OrdinalIgnoreCase }
$previousPrivateVariable = [Environment]::GetEnvironmentVariable('SUPPLYFLOW_LOCAL_PRIVATE_DIR', 'Process')
$script:ExitCode = 0

function Get-Field {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-FullDirectoryPath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'La ruta del directorio esta vacia.' }
    if (-not [IO.Path]::IsPathRooted($Path)) {
        $Path = Join-Path -Path (Get-Location).ProviderPath -ChildPath $Path
    }
    $full = [IO.Path]::GetFullPath($Path)
    $root = [IO.Path]::GetPathRoot($full)
    while ($full.Length -gt $root.Length -and ($full.EndsWith('\') -or $full.EndsWith('/'))) {
        $full = $full.Substring(0, $full.Length - 1)
    }
    return $full
}

function Assert-NoLinkedAncestors {
    param([string]$Path)
    $current = $Path
    while (-not [string]::IsNullOrEmpty($current)) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'Usa rutas reales sin enlaces simbolicos ni junctions para ProjectPath y PrivatePath. Asi se comprueba que el secreto queda fuera del proyecto.'
            }
        }
        $parent = [IO.Directory]::GetParent($current)
        if ($null -eq $parent) { break }
        $current = $parent.FullName
    }
}

function Invoke-DockerChecked {
    param([string[]]$Arguments, [switch]$Capture)
    # Native stderr is displayed separately; it must never contaminate captured JSON.
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $nativeExit = -1
    try {
        if ($Capture) {
            $output = @(& $script:DockerExecutable @Arguments)
            $nativeExit = $LASTEXITCODE
        }
        else {
            & $script:DockerExecutable @Arguments | Out-Host
            $nativeExit = $LASTEXITCODE
        }
    }
    finally { $ErrorActionPreference = $savedPreference }
    if ($nativeExit -ne 0) {
        # Never interpolate command arguments: future commands might contain secrets.
        throw ('Docker devolvio codigo {0}. Revisa el mensaje anterior; la accion no se considera completada.' -f $nativeExit)
    }
    if ($Capture) { return [string]::Join([Environment]::NewLine, [string[]]$output) }
}

function Invoke-ComposeChecked {
    param([string[]]$Arguments, [switch]$Capture)
    $allArguments = @($script:ComposeArguments) + @($Arguments)
    if ($Capture) { return Invoke-DockerChecked -Arguments $allArguments -Capture }
    Invoke-DockerChecked -Arguments $allArguments
}

function Assert-LocalEndpoint {
    param([string]$Endpoint)
    if ([string]::IsNullOrWhiteSpace($Endpoint)) { throw 'Docker no informo un endpoint local valido.' }
    $normalized = $Endpoint.Replace('\', '/')
    if ($normalized -match '^unix:///[^\r\n]+$') { return }
    if ($normalized -match '^npipe:////\./pipe/[^\r\n]+$') { return }
    throw 'Este kit solo admite Docker local por socket Unix o named pipe local. El endpoint activo o DOCKER_HOST usa otra conexion. Selecciona tu contexto local de Docker Desktop y vuelve a ejecutar.'
}

function Assert-LocalLinuxDocker {
    $dockerCommand = Get-Command docker -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $dockerCommand) { throw 'No se encontro Docker. Instala o inicia Docker Desktop y abre una terminal nueva.' }
    $script:DockerExecutable = $dockerCommand.Source
    $dockerHostOverride = [Environment]::GetEnvironmentVariable('DOCKER_HOST', 'Process')
    if (-not [string]::IsNullOrWhiteSpace($dockerHostOverride)) {
        Assert-LocalEndpoint -Endpoint $dockerHostOverride
    }
    $contextRaw = Invoke-DockerChecked -Arguments @('context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}') -Capture
    try { $contextEndpoint = ConvertFrom-Json -InputObject $contextRaw }
    catch { throw 'No se pudo interpretar el endpoint del contexto de Docker.' }
    Assert-LocalEndpoint -Endpoint ([string]$contextEndpoint)
    $osTypeRaw = Invoke-DockerChecked -Arguments @('info', '--format', '{{json .OSType}}') -Capture
    try { $osType = ConvertFrom-Json -InputObject $osTypeRaw }
    catch { throw 'No se pudo comprobar el sistema operativo del servidor Docker.' }
    if ($osType -ne 'linux') { throw 'Docker debe usar contenedores Linux. Cambia Docker Desktop a Linux containers.' }
    $script:ComposeVersion = (Invoke-DockerChecked -Arguments @('compose', 'version', '--short') -Capture).Trim()
    if ($script:ComposeVersion -notmatch '^v?(\d+)\.' -or [int]$Matches[1] -lt 2) {
        throw 'Se requiere Docker Compose 2 o superior (docker compose). Actualiza Docker Desktop si solo tienes docker-compose V1.'
    }
    $upHelp = Invoke-DockerChecked -Arguments @('compose', 'up', '--help') -Capture
    if ($upHelp -notmatch '(?m)(?:^|\s)--wait(?:\s|$)' -or $upHelp -notmatch '(?m)(?:^|\s)--wait-timeout(?:\s|$)') {
        throw 'Tu version de Compose no ofrece --wait y --wait-timeout. Actualiza Docker Desktop antes de preparar este entorno.'
    }
}

function Open-PrivateLock {
    if ($null -ne $script:LockStream) { return }
    [IO.Directory]::CreateDirectory($script:PrivateDirectory) | Out-Null
    Assert-NoLinkedAncestors -Path $script:PrivateDirectory
    $lockPath = Join-Path $script:PrivateDirectory 'supplyflow-db.lock'
    if (Test-Path -LiteralPath $lockPath) { Assert-NoLinkedAncestors -Path $lockPath }
    try { $script:LockStream = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw 'No se pudo bloquear el directorio privado. Comprueba permisos y que no haya otra accion SupplyFlow-DockerDB o SupplyFlow-Dev en curso.' }
}

function Get-DatabaseSnapshot {
    param([switch]$AllowMissing)
    $idRaw = Invoke-ComposeChecked -Arguments @('ps', '--all', '--quiet', 'db') -Capture
    $ids = @($idRaw -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($ids.Count -eq 0) {
        if ($AllowMissing) { return $null }
        throw 'El contenedor db no existe. Ejecuta primero SupplyFlow-DockerDB.ps1 -Action Start.'
    }
    if ($ids.Count -ne 1) { throw 'Se esperaba un solo contenedor db para este proyecto. Revisa docker compose ps antes de continuar.' }
    # Deliberately inspect selected fields, never the container environment.
    # A JSON array avoids literal double quotes, which Windows PowerShell 5.1
    # may remove while forwarding arguments to a native executable.
    $template = '[{{json .Id}},{{json .State.Status}},{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}},{{json .Mounts}}]'
    $raw = Invoke-DockerChecked -Arguments @('inspect', '--type', 'container', '--format', $template, $ids[0]) -Capture
    try { $details = ConvertFrom-Json -InputObject $raw }
    catch { throw 'No se pudo interpretar el estado del contenedor db.' }
    if (@($details).Count -ne 4) { throw 'Docker no devolvio los cuatro campos de estado esperados.' }
    $mounts = @($details[3] | Where-Object { (Get-Field $_ 'Destination') -eq '/var/lib/mysql' })
    if ($mounts.Count -ne 1 -or (Get-Field $mounts[0] 'Type') -ne 'volume') {
        throw 'El contenedor db no tiene un unico volumen de datos en /var/lib/mysql.'
    }
    $actualVolume = [string](Get-Field $mounts[0] 'Name')
    if ($actualVolume -ne $script:DataVolumeName) { throw 'El volumen del contenedor db no coincide con el volumen resuelto por Compose. Se detiene antes de cambiar el contenedor.' }
    return [pscustomobject][ordered]@{
        container_id = [string]$details[0]
        state = [string]$details[1]
        health = [string]$details[2]
        data_volume = $actualVolume
    }
}

function Read-JsonEvidence {
    param([string]$FileName, [switch]$CheckFresh)
    $path = Join-Path $script:EvidenceDirectory $FileName
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw ('No se genero la evidencia esperada: {0}.' -f $FileName) }
    Assert-NoLinkedAncestors -Path $path
    try { $evidence = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($path)) }
    catch { throw ('La evidencia {0} no contiene JSON valido.' -f $FileName) }
    if ($CheckFresh) {
        $generatedRaw = Get-Field $evidence 'executed_at_utc'
        try {
            if ($generatedRaw -is [DateTime]) { $generatedUtc = $generatedRaw.ToUniversalTime() }
            else { $generatedUtc = [DateTimeOffset]::Parse([string]$generatedRaw, [Globalization.CultureInfo]::InvariantCulture).UtcDateTime }
        }
        catch { throw ('La evidencia {0} no contiene executed_at_utc valido.' -f $FileName) }
        if ($null -eq $script:LastToolStartedUtc -or $generatedUtc -lt $script:LastToolStartedUtc.AddSeconds(-2) -or $generatedUtc -gt [DateTime]::UtcNow.AddMinutes(1)) {
            throw ('La evidencia {0} no corresponde a esta ejecucion. Comprueba los relojes local/Docker y vuelve a ejecutar.' -f $FileName)
        }
    }
    return $evidence
}

function Write-JsonFile {
    param([string]$Path, $Value)
    Assert-NoLinkedAncestors -Path $Path
    $json = ConvertTo-Json -InputObject $Value -Depth 20
    [IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
}

function Assert-ExistingSecret {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        if ($Label -eq 'root') {
            throw 'Falta el secreto ORIGINAL secrets/mariadb-root.txt. Recupera el directorio privado del kit BD; este script no genera ni reemplaza la clave root.'
        }
        throw 'Falta secrets/api-db-password.txt. Ejecuta Start para preparar la cuenta nueva; si ya existe, recupera su secreto original.'
    }
    Assert-NoLinkedAncestors -Path $Path
    try { $secretText = [IO.File]::ReadAllText($Path).Trim() }
    catch { throw ('No se pudo leer el secreto {0}. Revisa los permisos del directorio privado.' -f $Label) }
    if ($secretText -notmatch '^[0-9a-fA-F]{64}$') {
        throw ('El secreto {0} no tiene el formato esperado (64 caracteres hexadecimales). No se modifica: recupera el archivo original.' -f $Label)
    }
    $secretText = $null
}

function Initialize-ComposeIdentity {
    $raw = Invoke-ComposeChecked -Arguments @('config', '--format', 'json') -Capture
    try { $config = ConvertFrom-Json -InputObject $raw }
    catch { throw 'Compose no devolvio JSON valido. Revisa los tres archivos Compose y usa una version con soporte de !override (2.24.4 o superior).' }
    $script:ProjectName = [string](Get-Field $config 'name')
    $volumeDefinition = Get-Field (Get-Field $config 'volumes') 'supplyflow_db_data'
    $script:DataVolumeName = [string](Get-Field $volumeDefinition 'name')
    if ([string]::IsNullOrWhiteSpace($script:ProjectName) -or [string]::IsNullOrWhiteSpace($script:DataVolumeName)) {
        throw 'Compose no resolvio el proyecto y el volumen supplyflow_db_data. Se detiene para no adivinar el volumen existente.'
    }
    $services = Get-Field $config 'services'
    foreach ($name in @('db', 'api', 'frontend', 'web', 'api-db-tools')) {
        $service = Get-Field $services $name
        if ($null -eq $service) { throw ('Falta el servicio {0} en la configuracion combinada.' -f $name) }
        if ((Get-Field $service 'network_mode') -eq 'host') { throw ('El servicio {0} no debe usar red host.' -f $name) }
        if ($name -ne 'web' -and @(Get-Field $service 'ports' | Where-Object { $null -ne $_ }).Count -gt 0) {
            throw ('El servicio {0} publica puertos. Solo web debe publicar 127.0.0.1:8080 en este entorno.' -f $name)
        }
    }
    $databaseService = Get-Field $services 'db'
    $dataMounts = @(Get-Field $databaseService 'volumes' | Where-Object { (Get-Field $_ 'target') -eq '/var/lib/mysql' })
    if ($dataMounts.Count -ne 1 -or (Get-Field $dataMounts[0] 'type') -ne 'volume' -or (Get-Field $dataMounts[0] 'source') -ne 'supplyflow_db_data') {
        throw 'db debe conservar el volumen supplyflow_db_data en /var/lib/mysql.'
    }
    $webService = Get-Field $services 'web'
    $webPorts = @(Get-Field $webService 'ports' | Where-Object { $null -ne $_ })
    if ($webPorts.Count -ne 1 -or [string](Get-Field $webPorts[0] 'host_ip') -ne '127.0.0.1' -or [string](Get-Field $webPorts[0] 'published') -ne '8080' -or [string](Get-Field $webPorts[0] 'target') -ne '80') {
        throw 'web debe publicar unicamente 127.0.0.1:8080 hacia el puerto 80. Revisa que !override elimine el puerto del Compose original.'
    }
    foreach ($mount in @(Get-Field $webService 'volumes' | Where-Object { $null -ne $_ })) {
        if ((Get-Field $mount 'target') -eq '/usr/share/nginx/html') {
            throw 'El gateway web conserva el montaje estatico del proyecto completo. Revisa !override en compose.supply-dev.yml.'
        }
    }
}

function Assert-HistoricalPersistence {
    $historyPath = Join-Path $script:EvidenceDirectory 'persistence.json'
    if (-not (Test-Path -LiteralPath $historyPath -PathType Leaf)) { return }
    $script:HistoricalPersistencePresent = $true
    $proof = Read-JsonEvidence -FileName 'persistence.json'
    if ((Get-Field $proof 'result') -ne 'PASS' -or (Get-Field $proof 'status') -ne 'PERSISTENCE_VERIFIED') {
        throw 'La evidencia historica persistence.json no acredita persistencia valida. Revisa ese reporte y su procedencia antes de continuar; este kit no repite ni altera la prueba anterior.'
    }
    if ((Get-Field $proof 'schema_sha256') -ne $script:ExpectedSchemaHash -or (Get-Field $proof 'structure_fingerprint') -ne $script:ExpectedStructure -or (Get-Field $proof 'tables') -ne 74) {
        throw 'persistence.json no corresponde al esquema v0.3 de 74 tablas esperado.'
    }
    if ((Get-Field $proof 'data_volume') -ne $script:DataVolumeName -or (Get-Field $proof 'compose_project') -ne $script:ProjectName) {
        throw 'persistence.json corresponde a otro proyecto o volumen. Conserva el nombre de carpeta/proyecto y el directorio privado originales.'
    }
    $checks = Get-Field $proof 'checks'
    foreach ($name in @('container_recreated', 'data_volume_preserved', 'sql_hash_unchanged', 'structure_unchanged', 'tables_74_before_and_after', 'zero_rows_before_and_after')) {
        if ((Get-Field $checks $name) -ne $true) { throw ('La evidencia historica de persistencia no confirma: {0}.' -f $name) }
    }
    # Historical evidence is optional. Current rows are allowed; the mandatory
    # proof comes from the live schema inspection, not a previous empty database.
}

function Assert-DatabaseHealthy {
    $snapshot = Get-DatabaseSnapshot
    if ($snapshot.state -ne 'running' -or $snapshot.health -ne 'healthy') {
        throw ('db no esta listo (estado={0}, health={1}). Ejecuta SupplyFlow-DockerDB.ps1 -Action Start y luego vuelve a ejecutar SupplyFlow-Dev.ps1 -Action Start.' -f $snapshot.state, $snapshot.health)
    }
    return $snapshot
}

function Assert-DatabasePreserved {
    $after = Assert-DatabaseHealthy
    if ($null -eq $script:BeforeDatabase -or $after.container_id -ne $script:BeforeDatabase.container_id -or $after.data_volume -ne $script:BeforeDatabase.data_volume) {
        throw 'El contenedor db o su volumen cambiaron durante la accion. Se detiene: este kit no debe recrear ni sustituir la BD existente.'
    }
    return $after
}

function Get-ServiceSnapshot {
    param([ValidateSet('api', 'frontend', 'web')][string]$Name)
    $idRaw = Invoke-ComposeChecked -Arguments @('ps', '--all', '--quiet', $Name) -Capture
    $ids = @($idRaw -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($ids.Count -eq 0) { return $null }
    if ($ids.Count -ne 1) { throw ('Se esperaba un solo contenedor del servicio {0}.' -f $Name) }
    $template = '[{{json .Id}},{{json .State.Status}},{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}}]'
    $raw = Invoke-DockerChecked -Arguments @('inspect', '--type', 'container', '--format', $template, $ids[0]) -Capture
    try { $details = ConvertFrom-Json -InputObject $raw }
    catch { throw ('No se pudo interpretar el estado del servicio {0}.' -f $Name) }
    if (@($details).Count -ne 3) { throw ('Docker devolvio campos inesperados al inspeccionar {0}.' -f $Name) }
    return [pscustomobject][ordered]@{ container_id = [string]$details[0]; state = [string]$details[1]; health = [string]$details[2] }
}

function Get-ApplicationSnapshots {
    param([switch]$RequireHealthy)
    $snapshots = [ordered]@{}
    foreach ($name in @('api', 'frontend', 'web')) {
        $snapshot = Get-ServiceSnapshot -Name $name
        if ($RequireHealthy -and ($null -eq $snapshot -or $snapshot.state -ne 'running' -or $snapshot.health -ne 'healthy')) {
            throw ('El servicio {0} no esta running/healthy. Ejecuta Start y revisa los logs de ese servicio.' -f $name)
        }
        $snapshots[$name] = $snapshot
    }
    return $snapshots
}

function Build-DatabaseTools {
    if ($script:ToolsBuilt) { return }
    Write-Host 'Preparando api-db-tools para comprobar la BD existente y la cuenta de la API.'
    Invoke-ComposeChecked -Arguments @('build', 'api-db-tools')
    $script:ToolsBuilt = $true
}

function Invoke-DatabaseTool {
    param([ValidateSet('inspect', 'provision', 'verify')][string]$ToolAction)
    $null = Assert-DatabasePreserved
    Build-DatabaseTools
    $script:LastToolStartedUtc = [DateTime]::UtcNow
    Invoke-ComposeChecked -Arguments @('run', '--rm', '--no-deps', 'api-db-tools', $ToolAction)
    $proof = Read-JsonEvidence -FileName ('dev-db-' + $ToolAction + '.json') -CheckFresh
    if ((Get-Field $proof 'result') -ne 'PASS') { throw ('La comprobacion SQL {0} no informa PASS. Revisa su evidencia sin credenciales.' -f $ToolAction) }
    if ((Get-Field $proof 'schema_sha256') -ne $script:ExpectedSchemaHash -or (Get-Field $proof 'structure_fingerprint') -ne $script:ExpectedStructure -or (Get-Field $proof 'tables') -ne 74 -or (Get-Field $proof 'database') -ne 'supplyflow_dev') {
        throw 'La comprobacion viva no confirma el esquema supplyflow_dev v0.3 de 74 tablas esperado. No se reinstala ni se cambia la BD.'
    }
    return $proof
}

function New-ApiSecret {
    # Called only after an authenticated inspect reports the API account absent.
    Assert-NoLinkedAncestors -Path (Split-Path -Parent $script:ApiSecretPath)
    $randomBytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($randomBytes) }
    finally { $generator.Dispose() }
    $hexPassword = -join ($randomBytes | ForEach-Object { $_.ToString('x2') })
    $passwordBytes = [Text.Encoding]::ASCII.GetBytes($hexPassword)
    $secretStream = $null
    try {
        $secretStream = [IO.File]::Open($script:ApiSecretPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $secretStream.Write($passwordBytes, 0, $passwordBytes.Length)
        $secretStream.Flush()
        $script:SecretCreated = $true
    }
    catch { throw 'No se pudo crear api-db-password.txt con CreateNew. No se sobrescribio ninguna clave; revisa el directorio privado y sus permisos.' }
    finally {
        if ($null -ne $secretStream) { $secretStream.Dispose() }
        [Array]::Clear($randomBytes, 0, $randomBytes.Length)
        [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
        $hexPassword = $null
    }
}

function Prepare-ApiAccount {
    $inspection = Invoke-DatabaseTool -ToolAction 'inspect'
    $accountExists = Get-Field $inspection 'account_exists'
    if ($accountExists -isnot [bool]) { throw 'inspect no devolvio account_exists como booleano. No se genera una clave sin confirmar la cuenta.' }
    if (-not (Test-Path -LiteralPath $script:ApiSecretPath -PathType Leaf)) {
        if ($accountExists) {
            throw 'La cuenta supplyflow_api_local ya existe, pero falta api-db-password.txt. Recupera su secreto original; este script no lo reemplaza ni cambia la contrasena SQL.'
        }
        New-ApiSecret
    }
    Assert-ExistingSecret -Path $script:ApiSecretPath -Label 'API'
    $null = Invoke-DatabaseTool -ToolAction 'provision'
}

function Get-LocalHttp {
    param([string]$Path)
    $uri = 'http://127.0.0.1:8080' + $Path
    try { $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -Method Get -TimeoutSec 30 -MaximumRedirection 0 }
    catch { throw ('La comprobacion HTTP de {0} fallo. Ejecuta Start y revisa web/api/frontend; no se muestra el cuerpo del error para evitar divulgar datos.' -f $Path) }
    if ([int]$response.StatusCode -ne 200) { throw ('La ruta {0} no respondio HTTP 200.' -f $Path) }
    return $response
}

function Test-HttpEndpoints {
    $health = Get-LocalHttp -Path '/api/v1/health'
    try { $healthJson = ConvertFrom-Json -InputObject ([string]$health.Content) }
    catch { throw '/api/v1/health no devolvio JSON valido.' }
    if ((Get-Field $healthJson 'status') -ne 'ok' -or (Get-Field $healthJson 'service') -ne 'supplyflow-api') { throw '/api/v1/health no identifica una API SupplyFlow operativa.' }

    $ready = Get-LocalHttp -Path '/api/v1/ready'
    try { $readyJson = ConvertFrom-Json -InputObject ([string]$ready.Content) }
    catch { throw '/api/v1/ready no devolvio JSON valido.' }
    $checks = Get-Field $readyJson 'checks'
    $database = Get-Field $readyJson 'database'
    if ((Get-Field $readyJson 'status') -ne 'ready' -or (Get-Field $readyJson 'service') -ne 'supplyflow-api' -or (Get-Field $checks 'database') -ne 'ok' -or (Get-Field $checks 'session') -ne 'ok' -or (Get-Field $database 'engine') -ne 'MariaDB' -or (Get-Field $database 'schema') -ne 'supplyflow_dev') {
        throw '/api/v1/ready no confirma la conexion a supplyflow_dev y la sesion SQL esperada.'
    }

    $diagnostic = Get-LocalHttp -Path '/__supplyflow/dev'
    if ([string]$diagnostic.Content -notmatch '<meta\s+name="supplyflow-dev-stack"\s+content="0\.2"\s*/?>') { throw 'El gateway no sirve la pagina de diagnostico del kit 0.2.' }
    $frontend = Get-LocalHttp -Path '/'
    if ([string]$frontend.Content -notmatch '/@vite/client' -or [string]$frontend.Content -notmatch '/src/main\.jsx') {
        throw 'La raiz no sirve el index de React mediante Vite. Revisa el gateway y frontend.'
    }
    $entrypoint = Get-LocalHttp -Path '/src/main.jsx'
    if ([string]$entrypoint.Content -match '(?i)<!doctype\s+html|vite-error-overlay' -or [string]$entrypoint.Content -notmatch 'createRoot') {
        throw 'Vite no devolvio el modulo main.jsx transformado esperado.'
    }
    return [ordered]@{
        api_health = 'PASS'
        api_ready_database_and_session = 'PASS'
        diagnostic_page = 'PASS'
        frontend_vite_index = 'PASS'
        frontend_main_module = 'PASS'
    }
}

function New-ActionSummary {
    param([string]$Status)
    return [ordered]@{
        kit_version = '0.2'
        action = $Action
        result = 'PASS'
        status = $Status
        environment = 'docker-local'
        time_utc = [DateTime]::UtcNow.ToString('o')
        compose_project = $script:ProjectName
        compose_version = $script:ComposeVersion
        data_volume = $script:DataVolumeName
        project_path = $script:ProjectDirectory
        evidence_path = $script:EvidenceDirectory
        api_secret_created = $script:SecretCreated
        historical_persistence_evidence_present = $script:HistoricalPersistencePresent
        frontend_url = 'http://localhost:8080/'
        diagnostic_url = 'http://localhost:8080/__supplyflow/dev'
    }
}

function Add-VerifiedFoundation {
    param($Summary, $Proof)
    foreach ($key in @('database', 'server_version', 'schema_sha256', 'structure_fingerprint', 'tables')) {
        $Summary[$key] = Get-Field $Proof $key
    }
    $Summary['api_database_user'] = 'supplyflow_api_local'
    $Summary['api_database_privileges'] = 'SELECT on supplyflow_dev.*'
    $Summary['sql_account_verified'] = $true
    $Summary['db_before'] = $script:BeforeDatabase
    $Summary['db_after'] = Assert-DatabasePreserved
    $Summary['database_container_preserved'] = $true
    $Summary['database_volume_preserved'] = $true
}

try {
    # HF1: resolve an omitted ProjectPath inside the body, not at parameter binding.
    if (-not $PSBoundParameters.ContainsKey('ProjectPath')) {
        $ProjectPath = $PSScriptRoot
        if ([string]::IsNullOrWhiteSpace($ProjectPath) -and -not [string]::IsNullOrWhiteSpace($PSCommandPath)) { $ProjectPath = Split-Path -Parent $PSCommandPath }
        if ([string]::IsNullOrWhiteSpace($ProjectPath)) { throw 'No se pudo determinar la carpeta del script. Indica -ProjectPath con la ruta completa del proyecto.' }
    }
    $script:ProjectDirectory = Get-FullDirectoryPath -Path $ProjectPath
    if (-not (Test-Path -LiteralPath $script:ProjectDirectory -PathType Container)) { throw 'ProjectPath no es un directorio existente.' }
    if (-not $PSBoundParameters.ContainsKey('PrivatePath')) {
        $parent = [IO.Directory]::GetParent($script:ProjectDirectory)
        if ($null -eq $parent) { throw 'El proyecto debe ser una carpeta, no la raiz del disco.' }
        $PrivatePath = Join-Path $parent.FullName ((Split-Path -Leaf $script:ProjectDirectory) + '-docker-private')
    }
    $script:PrivateDirectory = Get-FullDirectoryPath -Path $PrivatePath
    $projectPrefix = $script:ProjectDirectory + [IO.Path]::DirectorySeparatorChar
    if ($script:PrivateDirectory.Equals($script:ProjectDirectory, $script:PathComparison) -or $script:PrivateDirectory.StartsWith($projectPrefix, $script:PathComparison)) {
        throw 'PrivatePath debe estar FUERA del proyecto. Usa el directorio privado original, por ejemplo C:\Dev\supply-docker-private.'
    }
    if ($script:PrivateDirectory -eq [IO.Path]::GetPathRoot($script:PrivateDirectory)) { throw 'PrivatePath debe ser una carpeta dedicada, no la raiz del disco.' }
    Assert-NoLinkedAncestors -Path $script:ProjectDirectory
    Assert-NoLinkedAncestors -Path $script:PrivateDirectory
    $baseCompose = Join-Path $script:ProjectDirectory 'docker-compose.yml'
    $dbCompose = Join-Path $script:ProjectDirectory 'compose.supply-db.yml'
    $devCompose = Join-Path $script:ProjectDirectory 'compose.supply-dev.yml'
    foreach ($file in @($baseCompose, $dbCompose, $devCompose)) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw ('Falta el archivo requerido: {0}.' -f $file) }
    }
    $script:EvidenceDirectory = Join-Path $script:PrivateDirectory 'evidence'
    $script:RootSecretPath = Join-Path $script:PrivateDirectory 'secrets/mariadb-root.txt'
    $script:ApiSecretPath = Join-Path $script:PrivateDirectory 'secrets/api-db-password.txt'
    if ($Action -ne 'Status') {
        Assert-ExistingSecret -Path $script:RootSecretPath -Label 'root'
        if ($Action -eq 'Verify') { Assert-ExistingSecret -Path $script:ApiSecretPath -Label 'API' }
    }
    [Environment]::SetEnvironmentVariable('SUPPLYFLOW_LOCAL_PRIVATE_DIR', $script:PrivateDirectory, 'Process')
    $script:ComposeArguments = @('compose', '--project-directory', $script:ProjectDirectory, '-f', $baseCompose, '-f', $dbCompose, '-f', $devCompose, '--profile', 'dev', '--profile', 'dev-tools')
    Assert-LocalLinuxDocker
    Initialize-ComposeIdentity

    if ($Action -eq 'Status') {
        $summary = New-ActionSummary -Status 'STATUS_ONLY'
        $summary['db'] = Get-DatabaseSnapshot -AllowMissing
        $summary['services'] = Get-ApplicationSnapshots
        $summary['root_secret_file_present'] = Test-Path -LiteralPath $script:RootSecretPath -PathType Leaf
        $summary['api_secret_file_present'] = Test-Path -LiteralPath $script:ApiSecretPath -PathType Leaf
        $summary['note'] = 'Solo consulta de estado. No instala, inicia servicios, crea claves ni verifica SQL/HTTP.'
    }
    else {
        Open-PrivateLock
        [IO.Directory]::CreateDirectory($script:EvidenceDirectory) | Out-Null
        Assert-NoLinkedAncestors -Path $script:EvidenceDirectory
        Assert-HistoricalPersistence
        $script:BeforeDatabase = Assert-DatabaseHealthy
        if ($Action -in @('Prepare', 'Start')) { Prepare-ApiAccount }
        if ($Action -eq 'Start') {
            Write-Host 'Construyendo API y frontend con sus archivos de dependencias fijadas.'
            Invoke-ComposeChecked -Arguments @('build', 'api', 'frontend')
            Write-Host 'Recreando api, frontend y web para aplicar codigo y dependencias. La primera descarga npm puede tardar; se esperan hasta 600 segundos. El contenedor db existente permanece en ejecucion.'
            Invoke-ComposeChecked -Arguments @('up', '-d', '--no-deps', '--force-recreate', '--wait', '--wait-timeout', '600', 'api', 'frontend', 'web')
        }
        $proof = Invoke-DatabaseTool -ToolAction 'verify'
        if ($Action -eq 'Prepare') {
            $summary = New-ActionSummary -Status 'API_DATABASE_PREPARED'
            $summary['note'] = 'Cuenta API preparada y validada con SELECT solamente; ejecuta Start para iniciar los servicios de desarrollo.'
        }
        else {
            $services = Get-ApplicationSnapshots -RequireHealthy
            $httpChecks = Test-HttpEndpoints
            $summary = New-ActionSummary -Status 'DEV_STACK_VERIFIED'
            $summary['services'] = $services
            $summary['http_checks'] = $httpChecks
            $summary['note'] = 'React/Vite, gateway y API responden; la cuenta API consulta la BD existente. Esta fase verifica la infraestructura, no los flujos de negocio del navegador.'
        }
        Add-VerifiedFoundation -Summary $summary -Proof $proof
        Write-JsonFile -Path (Join-Path $script:EvidenceDirectory ('dev-' + $Action.ToLowerInvariant() + '.json')) -Value $summary
    }
    Write-Host ''
    Write-Host 'Resumen sin credenciales (puedes compartir este JSON):'
    Write-Output (ConvertTo-Json -InputObject $summary -Depth 20)
}
catch {
    $script:ExitCode = 1
    $failure = [ordered]@{
        kit_version = '0.2'
        action = $Action
        result = 'FAIL'
        time_utc = [DateTime]::UtcNow.ToString('o')
        message = $_.Exception.Message
    }
    if ($Action -ne 'Status' -and $null -ne $script:LockStream -and $null -ne $script:EvidenceDirectory -and (Test-Path -LiteralPath $script:EvidenceDirectory -PathType Container)) {
        try { Write-JsonFile -Path (Join-Path $script:EvidenceDirectory ('dev-' + $Action.ToLowerInvariant() + '.json')) -Value $failure }
        catch { Write-Host 'No se pudo guardar la evidencia de fallo; revisa los permisos del directorio privado.' -ForegroundColor Yellow }
    }
    Write-Host ('ERROR: ' + $failure.message) -ForegroundColor Red
    Write-Output (ConvertTo-Json -InputObject $failure -Depth 5)
}
finally {
    if ($null -ne $script:LockStream) { $script:LockStream.Dispose() }
    [Environment]::SetEnvironmentVariable('SUPPLYFLOW_LOCAL_PRIVATE_DIR', $previousPrivateVariable, 'Process')
}
exit $script:ExitCode

