#requires -Version 5.1
<#
.SYNOPSIS
  Prepara y comprueba la base LOCAL de SupplyFlow con Docker Compose.
.EXAMPLE
  .\SupplyFlow-DockerDB.ps1 -Action Start
.EXAMPLE
  .\SupplyFlow-DockerDB.ps1 -Action Install
.EXAMPLE
  .\SupplyFlow-DockerDB.ps1 -Action Persistence
.NOTES
  Compatible con Windows PowerShell 5.1 y PowerShell 7.
  No inicia web, no modifica .env y no elimina bases ni volumenes.
  El directorio privado debe permanecer fuera del proyecto publicado por Nginx.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Prepare', 'Start', 'Install', 'Verify', 'Test', 'Persistence', 'Status')]
    [string]$Action = 'Status',

    [string]$ProjectPath,

    [string]$PrivatePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ExpectedSchemaHash = '2592455e38491b644b0f2c734eadf3aa33db5ccdc57dbfa54229f616be4056e5'
$script:ToolsBuilt = $false
$script:SecretCreated = $false
$script:LockStream = $null
$script:EvidenceDirectory = $null
$script:LastToolStartedUtc = $null
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

function Initialize-ComposeIdentity {
    $raw = Invoke-ComposeChecked -Arguments @('config', '--format', 'json') -Capture
    try { $config = ConvertFrom-Json -InputObject $raw }
    catch { throw 'Compose no devolvio una configuracion JSON valida. Revisa los dos archivos Compose.' }
    $script:ProjectName = [string](Get-Field $config 'name')
    $volumeDefinitions = Get-Field $config 'volumes'
    $volumeDefinition = Get-Field $volumeDefinitions 'supplyflow_db_data'
    $script:DataVolumeName = [string](Get-Field $volumeDefinition 'name')
    if ([string]::IsNullOrWhiteSpace($script:ProjectName) -or [string]::IsNullOrWhiteSpace($script:DataVolumeName)) {
        throw 'Compose no resolvio el proyecto y el volumen supplyflow_db_data. Se detiene para no adivinar el volumen existente.'
    }
    $services = Get-Field $config 'services'
    $databaseService = Get-Field $services 'db'
    $dataMounts = @(Get-Field $databaseService 'volumes' | Where-Object { (Get-Field $_ 'target') -eq '/var/lib/mysql' })
    if ($dataMounts.Count -ne 1 -or (Get-Field $dataMounts[0] 'type') -ne 'volume' -or (Get-Field $dataMounts[0] 'source') -ne 'supplyflow_db_data') {
        throw 'El servicio db debe usar supplyflow_db_data como volumen en /var/lib/mysql.'
    }
    if (@(Get-Field $databaseService 'ports' | Where-Object { $null -ne $_ }).Count -gt 0) {
        throw 'La configuracion combinada publica puertos de db. Este kit local requiere db sin puertos publicados.'
    }
    if ((Get-Field $databaseService 'network_mode') -eq 'host') {
        throw 'La configuracion combinada usa red host para db; esta modalidad no pertenece a este kit local.'
    }
}

function Get-ExistingDataVolumes {
    $exactRaw = Invoke-DockerChecked -Arguments @('volume', 'ls', '--filter', ('name=' + $script:DataVolumeName), '--format', '{{.Name}}') -Capture
    $labelRaw = Invoke-DockerChecked -Arguments @('volume', 'ls', '--filter', ('label=com.docker.compose.project=' + $script:ProjectName), '--filter', 'label=com.docker.compose.volume=supplyflow_db_data', '--format', '{{.Name}}') -Capture
    $names = @($exactRaw -split '\r?\n' | Where-Object { $_ -eq $script:DataVolumeName })
    $names += @($labelRaw -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    return @($names | Sort-Object -Unique)
}

function Assert-ExistingSecret {
    if (-not (Test-Path -LiteralPath $script:SecretPath -PathType Leaf)) {
        throw 'No existe el archivo privado del secreto. Ejecuta Start para un entorno nuevo. Si ya existe el volumen, recupera el secreto original; el script no lo reemplaza.'
    }
    Assert-NoLinkedAncestors -Path $script:SecretPath
    try { $secretText = [IO.File]::ReadAllText($script:SecretPath).Trim() }
    catch { throw 'No se pudo leer el archivo privado del secreto. Revisa sus permisos.' }
    if ($secretText -notmatch '^[0-9a-fA-F]{64}$') {
        throw 'El archivo privado del secreto no tiene el formato de este kit (64 caracteres hexadecimales). No se modifica: comprueba que sea el archivo original.'
    }
    $secretText = $null
}

function Open-PrivateLock {
    if ($null -ne $script:LockStream) { return }
    [IO.Directory]::CreateDirectory($script:PrivateDirectory) | Out-Null
    Assert-NoLinkedAncestors -Path $script:PrivateDirectory
    $lockPath = Join-Path $script:PrivateDirectory 'supplyflow-db.lock'
    if (Test-Path -LiteralPath $lockPath) { Assert-NoLinkedAncestors -Path $lockPath }
    try { $script:LockStream = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw 'No se pudo bloquear el directorio privado. Comprueba permisos y que no haya otra accion SupplyFlow-DockerDB en curso.' }
}

function Prepare-PrivateStorage {
    Open-PrivateLock
    if (-not (Test-Path -LiteralPath $script:SecretPath -PathType Leaf)) {
        $existingVolumes = @(Get-ExistingDataVolumes)
        if ($existingVolumes.Count -gt 0) {
            throw 'Ya existe un volumen de datos de este proyecto, pero falta su secreto. Se bloqueo la generacion de otra clave. Recupera el archivo mariadb-root.txt original en el directorio privado; no borres el volumen.'
        }
        [IO.Directory]::CreateDirectory((Split-Path -Parent $script:SecretPath)) | Out-Null
        Assert-NoLinkedAncestors -Path (Split-Path -Parent $script:SecretPath)
        $randomBytes = New-Object byte[] 32
        $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $randomGenerator.GetBytes($randomBytes) }
        finally { $randomGenerator.Dispose() }
        $hexPassword = -join ($randomBytes | ForEach-Object { $_.ToString('x2') })
        $passwordBytes = [Text.Encoding]::ASCII.GetBytes($hexPassword)
        $secretStream = $null
        try {
            # CreateNew prevents any overwrite, including a concurrent file creation.
            $secretStream = [IO.File]::Open($script:SecretPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
            $secretStream.Write($passwordBytes, 0, $passwordBytes.Length)
            $secretStream.Flush()
            $script:SecretCreated = $true
        }
        catch { throw 'No se pudo crear el secreto con CreateNew. No se sobrescribio un archivo existente; revisa la ruta privada y sus permisos.' }
        finally {
            if ($null -ne $secretStream) { $secretStream.Dispose() }
            [Array]::Clear($randomBytes, 0, $randomBytes.Length)
            [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
            $hexPassword = $null
        }
    }
    Assert-ExistingSecret
    [IO.Directory]::CreateDirectory($script:EvidenceDirectory) | Out-Null
    Assert-NoLinkedAncestors -Path $script:EvidenceDirectory
}

function Require-PrivateStorage {
    Assert-ExistingSecret
    Open-PrivateLock
    [IO.Directory]::CreateDirectory($script:EvidenceDirectory) | Out-Null
    Assert-NoLinkedAncestors -Path $script:EvidenceDirectory
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

function Assert-DatabaseHealthy {
    $snapshot = Get-DatabaseSnapshot
    if ($snapshot.state -ne 'running' -or $snapshot.health -ne 'healthy') {
        throw ('db no esta listo (estado={0}, health={1}). Ejecuta Start y revisa sus mensajes antes de instalar o verificar.' -f $snapshot.state, $snapshot.health)
    }
    return $snapshot
}

function Build-DatabaseTools {
    if ($script:ToolsBuilt) { return }
    Write-Host 'Preparando la imagen db-tools; Docker reutilizara su cache cuando sea posible.'
    Invoke-ComposeChecked -Arguments @('build', 'db-tools')
    $script:ToolsBuilt = $true
}

function Read-JsonEvidence {
    param([string]$FileName, [switch]$CheckFresh)
    $path = Join-Path $script:EvidenceDirectory $FileName
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw ('No se genero la evidencia esperada: {0}.' -f $FileName) }
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

function Invoke-DatabaseTool {
    param([ValidateSet('inspect', 'install', 'verify', 'test')][string]$ToolAction)
    $null = Assert-DatabaseHealthy
    Build-DatabaseTools
    $script:LastToolStartedUtc = [DateTime]::UtcNow
    Invoke-ComposeChecked -Arguments @('run', '--rm', '--no-deps', 'db-tools', $ToolAction)
}

function Read-VerifiedSchema {
    $proof = Read-JsonEvidence -FileName 'verify.json' -CheckFresh
    if ((Get-Field $proof 'result') -ne 'PASS') { throw 'verify.json no informa PASS; el esquema no se considera validado.' }
    if ((Get-Field $proof 'schema_sha256') -ne $script:ExpectedSchemaHash) { throw 'verify.json no corresponde al SQL v0.3 esperado.' }
    if ((Get-Field $proof 'tables') -ne 74 -or (Get-Field $proof 'rows_total') -ne 0) { throw 'Esta fase requiere las 74 tablas del esquema de desarrollo y cero filas.' }
    if ((Get-Field $proof 'structure_fingerprint') -notmatch '^[0-9a-f]{64}$') { throw 'Falta la huella estable de la estructura en verify.json.' }
    return $proof
}

function Write-JsonFile {
    param([string]$Path, $Value)
    $json = ConvertTo-Json -InputObject $Value -Depth 20
    [IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
}

function New-ActionSummary {
    param([string]$Status)
    return [ordered]@{
        kit_version = '0.1'
        kit_revision = 'HF1'
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
        secret_created = $script:SecretCreated
    }
}

try {
    # Windows PowerShell 5.1 can leave $PSScriptRoot empty during parameter
    # binding for advanced scripts invoked with -File (PowerShell issue #4688).
    # Resolve the omitted parameter here, after entering the script body.
    # An explicitly supplied empty ProjectPath still fails normal validation.
    if (-not $PSBoundParameters.ContainsKey('ProjectPath')) {
        $ProjectPath = $PSScriptRoot
        if ([string]::IsNullOrWhiteSpace($ProjectPath) -and -not [string]::IsNullOrWhiteSpace($PSCommandPath)) {
            $ProjectPath = Split-Path -Parent $PSCommandPath
        }
        if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
            throw 'No se pudo determinar la carpeta del script. Indica -ProjectPath con la ruta completa del proyecto.'
        }
    }
    $script:ProjectDirectory = Get-FullDirectoryPath -Path $ProjectPath
    if (-not (Test-Path -LiteralPath $script:ProjectDirectory -PathType Container)) { throw 'ProjectPath no es un directorio existente.' }
    if ([string]::IsNullOrWhiteSpace($PrivatePath)) {
        $projectParent = [IO.Directory]::GetParent($script:ProjectDirectory)
        if ($null -eq $projectParent) { throw 'El proyecto no puede ser la raiz del disco; indica una carpeta de proyecto.' }
        $PrivatePath = Join-Path $projectParent.FullName ((Split-Path -Leaf $script:ProjectDirectory) + '-docker-private')
    }
    $script:PrivateDirectory = Get-FullDirectoryPath -Path $PrivatePath
    $projectPrefix = $script:ProjectDirectory + [IO.Path]::DirectorySeparatorChar
    if ($script:PrivateDirectory.Equals($script:ProjectDirectory, $script:PathComparison) -or $script:PrivateDirectory.StartsWith($projectPrefix, $script:PathComparison)) {
        throw 'PrivatePath debe estar FUERA del proyecto: Nginx publica esa carpeta. Usa, por ejemplo, C:\Dev\supply-docker-private.'
    }
    if ($script:PrivateDirectory -eq [IO.Path]::GetPathRoot($script:PrivateDirectory)) { throw 'PrivatePath debe ser una carpeta dedicada, no la raiz del disco.' }
    Assert-NoLinkedAncestors -Path $script:ProjectDirectory
    Assert-NoLinkedAncestors -Path $script:PrivateDirectory
    $baseCompose = Join-Path $script:ProjectDirectory 'docker-compose.yml'
    $overlayCompose = Join-Path $script:ProjectDirectory 'compose.supply-db.yml'
    foreach ($composeFile in @($baseCompose, $overlayCompose)) {
        if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) { throw ('Falta el archivo requerido: {0}.' -f $composeFile) }
    }
    $script:EvidenceDirectory = Join-Path $script:PrivateDirectory 'evidence'
    $script:SecretPath = Join-Path $script:PrivateDirectory 'secrets/mariadb-root.txt'
    [Environment]::SetEnvironmentVariable('SUPPLYFLOW_LOCAL_PRIVATE_DIR', $script:PrivateDirectory, 'Process')
    $script:ComposeArguments = @('compose', '--project-directory', $script:ProjectDirectory, '-f', $baseCompose, '-f', $overlayCompose, '--profile', 'tools')
    Assert-LocalLinuxDocker
    Initialize-ComposeIdentity

    switch ($Action) {
        'Status' {
            $snapshot = Get-DatabaseSnapshot -AllowMissing
            $summary = New-ActionSummary -Status 'STATUS_ONLY'
            $summary['db'] = $snapshot
            $summary['data_volume_exists'] = @(Get-ExistingDataVolumes).Count -gt 0
            $summary['secret_file_present'] = Test-Path -LiteralPath $script:SecretPath -PathType Leaf
            $summary['note'] = 'Consulta de estado; no instala ni valida el esquema y no crea secretos.'
        }
        'Prepare' {
            Prepare-PrivateStorage
            $summary = New-ActionSummary -Status 'PREPARED'
            $summary['note'] = 'Directorios y secreto preparados; no se inicio ningun contenedor.'
        }
        'Start' {
            Prepare-PrivateStorage
            Write-Host 'Iniciando solo db y esperando su healthcheck (hasta 180 segundos).'
            Invoke-ComposeChecked -Arguments @('up', '-d', '--wait', '--wait-timeout', '180', 'db')
            $snapshot = Assert-DatabaseHealthy
            $summary = New-ActionSummary -Status 'DB_HEALTHY'
            $summary['db'] = $snapshot
            $summary['note'] = 'MariaDB responde al healthcheck. La instalacion y validacion del esquema se realizan con Install.'
        }
        'Install' {
            Require-PrivateStorage
            Invoke-DatabaseTool -ToolAction 'install'
            $installation = Read-JsonEvidence -FileName 'install.json' -CheckFresh
            # Existing databases are never reset. Verify also runs after ALREADY_EXISTS.
            Invoke-DatabaseTool -ToolAction 'verify'
            $proof = Read-VerifiedSchema
            $summary = New-ActionSummary -Status 'SCHEMA_VERIFIED'
            $summary['installation_status'] = Get-Field $installation 'status'
            $summary['database'] = Get-Field $proof 'database'
            $summary['server_version'] = Get-Field $proof 'server_version'
            $summary['schema_sha256'] = Get-Field $proof 'schema_sha256'
            $summary['structure_fingerprint'] = Get-Field $proof 'structure_fingerprint'
            $summary['tables'] = Get-Field $proof 'tables'
            $summary['rows_total'] = Get-Field $proof 'rows_total'
        }
        'Verify' {
            Require-PrivateStorage
            Invoke-DatabaseTool -ToolAction 'verify'
            $proof = Read-VerifiedSchema
            $summary = New-ActionSummary -Status 'SCHEMA_VERIFIED'
            foreach ($key in @('database', 'server_version', 'schema_sha256', 'structure_fingerprint', 'tables', 'rows_total')) {
                $summary[$key] = Get-Field $proof $key
            }
        }
        'Test' {
            Require-PrivateStorage
            Invoke-DatabaseTool -ToolAction 'test'
            $testProof = Read-JsonEvidence -FileName 'test.json' -CheckFresh
            $suite = Read-JsonEvidence -FileName 'integration_results.json'
            $suiteSummary = Get-Field $suite 'summary'
            $suiteResult = Get-Field $suite 'result'
            if ($suiteResult -notin @('PASS', 'PASS_WITH_OBSERVED_LIMITATION') -or (Get-Field $suiteSummary 'failed') -ne 0 -or (Get-Field $suiteSummary 'final_rows') -ne 0) {
                throw 'La suite no informa una ejecucion aceptada con cero fallos y cero filas finales. Revisa integration_results.json.'
            }
            if ((Get-Field $testProof 'result') -ne $suiteResult) { throw 'test.json e integration_results.json no coinciden en el resultado.' }
            $summary = New-ActionSummary -Status 'INTEGRATION_VERIFIED'
            $summary['result'] = $suiteResult
            $summary['database'] = Get-Field $suite 'database'
            $summary['integration_evidence'] = Join-Path $script:EvidenceDirectory 'integration_results.json'
            $summary['integration_summary'] = $suiteSummary
            $summary['note'] = 'Consulta integration_results.json para los casos y la limitacion decimal observada; no se importaron datos reales.'
        }
        'Persistence' {
            Require-PrivateStorage
            Invoke-DatabaseTool -ToolAction 'verify'
            $beforeProof = Read-VerifiedSchema
            $beforeContainer = Assert-DatabaseHealthy
            $runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
            $beforeFile = 'persistence-' + $runId + '-before.json'
            $afterFile = 'persistence-' + $runId + '-after.json'
            Copy-Item -LiteralPath (Join-Path $script:EvidenceDirectory 'verify.json') -Destination (Join-Path $script:EvidenceDirectory $beforeFile)
            Write-Host 'Recreando solo el contenedor db. El volumen de datos se conserva.'
            Invoke-ComposeChecked -Arguments @('up', '-d', '--no-deps', '--force-recreate', '--wait', '--wait-timeout', '180', 'db')
            $afterContainer = Assert-DatabaseHealthy
            Invoke-DatabaseTool -ToolAction 'verify'
            $afterProof = Read-VerifiedSchema
            Copy-Item -LiteralPath (Join-Path $script:EvidenceDirectory 'verify.json') -Destination (Join-Path $script:EvidenceDirectory $afterFile)
            $checks = [ordered]@{
                container_recreated = $beforeContainer.container_id -ne $afterContainer.container_id
                data_volume_preserved = $beforeContainer.data_volume -eq $afterContainer.data_volume
                sql_hash_unchanged = (Get-Field $beforeProof 'schema_sha256') -eq (Get-Field $afterProof 'schema_sha256')
                structure_unchanged = (Get-Field $beforeProof 'structure_fingerprint') -eq (Get-Field $afterProof 'structure_fingerprint')
                tables_74_before_and_after = (Get-Field $beforeProof 'tables') -eq 74 -and (Get-Field $afterProof 'tables') -eq 74
                zero_rows_before_and_after = (Get-Field $beforeProof 'rows_total') -eq 0 -and (Get-Field $afterProof 'rows_total') -eq 0
            }
            $summary = New-ActionSummary -Status 'PERSISTENCE_VERIFIED'
            $summary['checks'] = $checks
            $summary['before_container'] = $beforeContainer
            $summary['after_container'] = $afterContainer
            $summary['before_evidence'] = $beforeFile
            $summary['after_evidence'] = $afterFile
            $summary['database'] = Get-Field $afterProof 'database'
            $summary['schema_sha256'] = Get-Field $afterProof 'schema_sha256'
            $summary['structure_fingerprint'] = Get-Field $afterProof 'structure_fingerprint'
            $summary['tables'] = Get-Field $afterProof 'tables'
            $summary['rows_total'] = Get-Field $afterProof 'rows_total'
            if (@($checks.Values | Where-Object { $_ -ne $true }).Count -gt 0) {
                $summary['result'] = 'FAIL'
                $summary['status'] = 'PERSISTENCE_FAILED'
                Write-JsonFile -Path (Join-Path $script:EvidenceDirectory 'persistence.json') -Value $summary
                throw 'La comprobacion de persistencia fallo. Revisa persistence.json y sus evidencias; no se borraron volumenes.'
            }
            Write-JsonFile -Path (Join-Path $script:EvidenceDirectory 'persistence.json') -Value $summary
        }
    }

    if ($Action -ne 'Status') {
        Write-JsonFile -Path (Join-Path $script:EvidenceDirectory ('wrapper-' + $Action.ToLowerInvariant() + '.json')) -Value $summary
    }
    Write-Host ''
    Write-Host 'Resumen sin credenciales (puedes compartir este JSON):'
    Write-Output (ConvertTo-Json -InputObject $summary -Depth 20)
}
catch {
    $script:ExitCode = 1
    $failure = [ordered]@{
        action = $Action
        result = 'FAIL'
        time_utc = [DateTime]::UtcNow.ToString('o')
        message = $_.Exception.Message
    }
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Output (ConvertTo-Json -InputObject $failure -Depth 5)
}
finally {
    if ($null -ne $script:LockStream) { $script:LockStream.Dispose() }
    [Environment]::SetEnvironmentVariable('SUPPLYFLOW_LOCAL_PRIVATE_DIR', $previousPrivateVariable, 'Process')
}

exit $script:ExitCode
