#requires -Version 5.1
<#
.SYNOPSIS
  Inicia, consulta o detiene solo phpMyAdmin para la BD local ya existente.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\SupplyFlow-DBAdmin.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\SupplyFlow-DBAdmin.ps1 -Action Start -Port 8082
.NOTES
  Windows PowerShell 5.1 y PowerShell 7. No lee claves ni ejecuta SQL.
  Start requiere db running/healthy; Stop no requiere servicios saludables.
  El acceso es manual con la cuenta existente supplyflow_api_local.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Start', 'Status', 'Stop')]
    [string]$Action = 'Start',
    [string]$ProjectPath,
    [string]$PrivatePath,
    [ValidateRange(1024, 65535)]
    [int]$Port = 8081
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ExitCode = 0
$script:LockStream = $null
$script:EvidenceDirectory = $null
$script:Before = $null
$script:After = $null
$script:PathComparison = [StringComparison]::Ordinal
if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) { $script:PathComparison = [StringComparison]::OrdinalIgnoreCase }
$previousPrivate = [Environment]::GetEnvironmentVariable('SUPPLYFLOW_LOCAL_PRIVATE_DIR', 'Process')
$previousPort = [Environment]::GetEnvironmentVariable('SUPPLYFLOW_DBADMIN_PORT', 'Process')

function Get-Field {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -ne $property) { return $property.Value }
    return $null
}

function Get-FullDirectoryPath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'La ruta del directorio esta vacia.' }
    if (-not [IO.Path]::IsPathRooted($Path)) { $Path = Join-Path (Get-Location).ProviderPath $Path }
    $full = [IO.Path]::GetFullPath($Path)
    $root = [IO.Path]::GetPathRoot($full)
    while ($full.Length -gt $root.Length -and ($full.EndsWith('\') -or $full.EndsWith('/'))) { $full = $full.Substring(0, $full.Length - 1) }
    return $full
}

function Assert-NoLinkedAncestors {
    param([string]$Path)
    $current = $Path
    while (-not [string]::IsNullOrEmpty($current)) {
        if (Test-Path -LiteralPath $current) {
            if (((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'Usa rutas reales sin enlaces simbolicos ni junctions para el proyecto y su directorio privado.'
            }
        }
        $parent = [IO.Directory]::GetParent($current)
        if ($null -eq $parent) { break }
        $current = $parent.FullName
    }
}

function Invoke-DockerChecked {
    param([string[]]$Arguments, [switch]$Capture)
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $nativeExit = -1
    try {
        if ($Capture) { $output = @(& $script:DockerExecutable @Arguments); $nativeExit = $LASTEXITCODE }
        else { & $script:DockerExecutable @Arguments | Out-Host; $nativeExit = $LASTEXITCODE }
    }
    finally { $ErrorActionPreference = $savedPreference }
    if ($nativeExit -ne 0) { throw ('Docker devolvio codigo {0}. Revisa el mensaje anterior; la accion no se considera completada.' -f $nativeExit) }
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
    if ($normalized -match '^unix:///[^\r\n]+$' -or $normalized -match '^npipe:////\./pipe/[^\r\n]+$') { return }
    throw 'Solo se admite Docker local por socket Unix o named pipe local. Selecciona el contexto local de Docker Desktop.'
}

function Assert-LocalLinuxDocker {
    $command = Get-Command docker -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $command) { throw 'No se encontro Docker. Inicia Docker Desktop y abre una terminal nueva.' }
    $script:DockerExecutable = $command.Source
    $hostOverride = [Environment]::GetEnvironmentVariable('DOCKER_HOST', 'Process')
    if (-not [string]::IsNullOrWhiteSpace($hostOverride)) { Assert-LocalEndpoint -Endpoint $hostOverride }
    $endpoint = ConvertFrom-Json -InputObject (Invoke-DockerChecked -Arguments @('context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}') -Capture)
    Assert-LocalEndpoint -Endpoint ([string]$endpoint)
    $osType = ConvertFrom-Json -InputObject (Invoke-DockerChecked -Arguments @('info', '--format', '{{json .OSType}}') -Capture)
    if ($osType -ne 'linux') { throw 'Docker debe usar contenedores Linux. Cambia Docker Desktop a Linux containers.' }
    $script:ComposeVersion = (Invoke-DockerChecked -Arguments @('compose', 'version', '--short') -Capture).Trim()
    if ($script:ComposeVersion -notmatch '^v?(\d+)\.' -or [int]$Matches[1] -lt 2) { throw 'Se requiere Docker Compose 2 o superior (docker compose).' }
    if ($Action -eq 'Start') {
        $help = Invoke-DockerChecked -Arguments @('compose', 'up', '--help') -Capture
        if ($help -notmatch '(?m)(?:^|\s)--wait(?:\s|$)' -or $help -notmatch '(?m)(?:^|\s)--wait-timeout(?:\s|$)') { throw 'Actualiza Docker Desktop: Compose debe admitir --wait y --wait-timeout.' }
    }
}

function Initialize-ComposeIdentity {
    $config = ConvertFrom-Json -InputObject (Invoke-ComposeChecked -Arguments @('config', '--format', 'json') -Capture)
    $script:ProjectName = [string](Get-Field $config 'name')
    $script:DataVolumeName = [string](Get-Field (Get-Field (Get-Field $config 'volumes') 'supplyflow_db_data') 'name')
    if ([string]::IsNullOrWhiteSpace($script:ProjectName) -or [string]::IsNullOrWhiteSpace($script:DataVolumeName)) { throw 'Compose no resolvio el proyecto y su volumen supplyflow_db_data. No se adivina el volumen existente.' }
    $services = Get-Field $config 'services'
    foreach ($name in @('db', 'api', 'frontend', 'web', 'phpmyadmin')) {
        if ($null -eq (Get-Field $services $name)) { throw ('Falta el servicio {0} en los cuatro archivos Compose combinados.' -f $name) }
    }
    $database = Get-Field $services 'db'
    $mounts = @(Get-Field $database 'volumes' | Where-Object { (Get-Field $_ 'target') -eq '/var/lib/mysql' })
    if ($mounts.Count -ne 1 -or (Get-Field $mounts[0] 'type') -ne 'volume' -or (Get-Field $mounts[0] 'source') -ne 'supplyflow_db_data') { throw 'db debe conservar supplyflow_db_data en /var/lib/mysql.' }
    $admin = Get-Field $services 'phpmyadmin'
    $ports = @(Get-Field $admin 'ports' | Where-Object { $null -ne $_ })
    if ($ports.Count -ne 1 -or [string](Get-Field $ports[0] 'host_ip') -ne '127.0.0.1' -or [string](Get-Field $ports[0] 'published') -ne [string]$Port -or [string](Get-Field $ports[0] 'target') -ne '80' -or [string](Get-Field $ports[0] 'protocol') -ne 'tcp') {
        throw ('phpmyadmin debe publicar unicamente 127.0.0.1:{0}:80/tcp.' -f $Port)
    }
    if (-not [string]::IsNullOrWhiteSpace([string](Get-Field $admin 'network_mode'))) { throw 'phpmyadmin debe usar la red Compose compartida con db, sin network_mode especial.' }
    foreach ($field in @('secrets', 'volumes', 'configs', 'build', 'env_file', 'depends_on')) {
        if ($null -ne (Get-Field $admin $field)) { throw ('phpmyadmin no debe definir {0}; este complemento usa acceso manual y no monta claves.' -f $field) }
    }
    $environment = Get-Field $admin 'environment'
    if ([string](Get-Field $environment 'PMA_HOST') -ne 'db' -or [string](Get-Field $environment 'PMA_PORT') -ne '3306' -or [string](Get-Field $environment 'PMA_ARBITRARY') -ne '0') { throw 'phpmyadmin debe apuntar a db:3306 con PMA_ARBITRARY=0.' }
    foreach ($property in @($environment.PSObject.Properties)) {
        if ($property.Name -notin @('PMA_HOST', 'PMA_PORT', 'PMA_ARBITRARY', 'TZ')) { throw 'La configuracion phpmyadmin contiene variables no previstas. No se admiten usuarios, claves ni configuracion de acceso automatico.' }
    }
    $adminNetworks = Get-Field $admin 'networks'
    $dbNetworks = Get-Field $database 'networks'
    if ($null -eq $adminNetworks -or $null -eq $dbNetworks -or $null -eq $adminNetworks.PSObject.Properties['default'] -or $null -eq $dbNetworks.PSObject.Properties['default']) { throw 'phpmyadmin y db deben compartir la red default del proyecto Compose.' }
}

function Get-ServiceSnapshot {
    param([ValidateSet('db', 'api', 'frontend', 'web', 'phpmyadmin')][string]$Name)
    $idRaw = Invoke-ComposeChecked -Arguments @('ps', '--all', '--quiet', $Name) -Capture
    $ids = @($idRaw -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($ids.Count -eq 0) { return $null }
    if ($ids.Count -ne 1) { throw ('Se esperaba un solo contenedor del servicio {0}.' -f $Name) }
    # No se inspecciona el entorno. La plantilla sin comillas literales sirve en PS 5.1.
    $template = '[{{json .Id}},{{json .State.Status}},{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}},{{json .Mounts}},{{json .Config.Labels}},{{json .HostConfig.PortBindings}}]'
    $details = ConvertFrom-Json -InputObject (Invoke-DockerChecked -Arguments @('inspect', '--type', 'container', '--format', $template, $ids[0]) -Capture)
    if (@($details).Count -ne 6) { throw ('Docker devolvio campos inesperados al inspeccionar {0}.' -f $Name) }
    if ([string](Get-Field $details[4] 'com.docker.compose.project') -ne $script:ProjectName -or [string](Get-Field $details[4] 'com.docker.compose.service') -ne $Name) { throw ('El contenedor {0} no pertenece al proyecto/servicio Compose esperado.' -f $Name) }
    $snapshot = [ordered]@{ container_id = [string]$details[0]; state = [string]$details[1]; health = [string]$details[2] }
    if ($Name -eq 'db') {
        $mounts = @($details[3] | Where-Object { (Get-Field $_ 'Destination') -eq '/var/lib/mysql' })
        if ($mounts.Count -ne 1 -or (Get-Field $mounts[0] 'Type') -ne 'volume' -or [string](Get-Field $mounts[0] 'Name') -ne $script:DataVolumeName) { throw 'El volumen real de db no coincide con supplyflow_db_data resuelto por Compose. No se altera db.' }
        $snapshot['data_volume'] = [string](Get-Field $mounts[0] 'Name')
    }
    if ($Name -eq 'phpmyadmin') { $snapshot['port_bindings'] = $details[5] }
    return [pscustomobject]$snapshot
}

function Get-FoundationSnapshot {
    $snapshot = [ordered]@{}
    foreach ($name in @('db', 'api', 'frontend', 'web')) { $snapshot[$name] = Get-ServiceSnapshot -Name $name }
    return $snapshot
}

function Assert-DatabaseHealthy {
    param($Snapshot)
    if ($null -eq $Snapshot) { throw 'No existe db en este proyecto. Inicia primero la BD existente con SupplyFlow-DockerDB.ps1 -Action Start.' }
    if ($Snapshot.state -ne 'running' -or $Snapshot.health -ne 'healthy') { throw ('db no esta running/healthy (estado={0}, health={1}). Este complemento no inicia ni repara db.' -f $Snapshot.state, $Snapshot.health) }
}

function Get-PreservationChecks {
    param($Before, $After)
    $preserved = [ordered]@{}
    foreach ($name in @('db', 'api', 'frontend', 'web')) {
        $preserved[$name] = [string](Get-Field $Before[$name] 'container_id') -eq [string](Get-Field $After[$name] 'container_id')
    }
    return [ordered]@{
        db_container_preserved = $preserved['db']
        db_volume_preserved = [string](Get-Field $Before['db'] 'data_volume') -eq [string](Get-Field $After['db'] 'data_volume')
        application_containers_preserved = $preserved['api'] -and $preserved['frontend'] -and $preserved['web']
        services = $preserved
    }
}

function Test-AdminBinding {
    param($Snapshot)
    if ($null -eq $Snapshot) { return $false }
    $bindings = Get-Field $Snapshot 'port_bindings'
    if ($null -eq $bindings -or @($bindings.PSObject.Properties).Count -ne 1) { return $false }
    $httpBindings = @(Get-Field $bindings '80/tcp' | Where-Object { $null -ne $_ })
    return $httpBindings.Count -eq 1 -and [string](Get-Field $httpBindings[0] 'HostIp') -eq '127.0.0.1' -and [string](Get-Field $httpBindings[0] 'HostPort') -eq [string]$Port
}

function Assert-PortAvailable {
    param($ExistingAdmin)
    if ($null -ne $ExistingAdmin -and $ExistingAdmin.state -eq 'running' -and (Test-AdminBinding -Snapshot $ExistingAdmin)) { return }
    $listener = New-Object Net.Sockets.TcpListener ([Net.IPAddress]::Loopback), $Port
    try { $listener.ExclusiveAddressUse = $true; $listener.Start() }
    catch { throw ('El puerto local 127.0.0.1:{0} esta ocupado o no disponible. No se detuvo ningun proceso. Repite Start con -Port 8082 u otro puerto libre distinto de 8080.' -f $Port) }
    finally { $listener.Stop() }
}

function Test-AdminLoginPage {
    $response = $null
    $reader = $null
    try {
        $request = [Net.HttpWebRequest]::Create($script:AdminUrl)
        $request.Method = 'GET'
        $request.Proxy = $null
        $request.AllowAutoRedirect = $false
        $request.Timeout = 10000
        $request.ReadWriteTimeout = 10000
        $response = $request.GetResponse()
        $reader = New-Object IO.StreamReader ($response.GetResponseStream())
        $content = $reader.ReadToEnd()
        if ([int]$response.StatusCode -ne 200 -or $content -notmatch '(?i)phpMyAdmin' -or $content -notmatch '(?i)name\s*=\s*["'']pma_username["'']') { throw 'Respuesta inesperada.' }
    }
    catch { throw ('phpMyAdmin no devolvio HTTP 200 con su formulario de acceso en {0}. Consulta los logs de phpmyadmin; no se probaron credenciales.' -f $script:AdminUrl) }
    finally {
        if ($null -ne $reader) { $reader.Dispose() }
        if ($null -ne $response) { $response.Close() }
    }
    return [ordered]@{ status_code = 200; phpmyadmin_marker = $true; login_form = $true; authenticated = $false }
}

function Open-PrivateLock {
    if (-not (Test-Path -LiteralPath $script:PrivateDirectory -PathType Container)) { throw 'No existe el directorio privado original. Indica -PrivatePath con la carpeta usada por SupplyFlow-DockerDB y SupplyFlow-Dev.' }
    $lockPath = Join-Path $script:PrivateDirectory 'supplyflow-db.lock'
    Assert-NoLinkedAncestors -Path $lockPath
    try { $script:LockStream = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw 'No se pudo bloquear el directorio privado. Comprueba permisos y que no haya otra accion SupplyFlow en curso.' }
    Assert-NoLinkedAncestors -Path $script:EvidenceDirectory
    [IO.Directory]::CreateDirectory($script:EvidenceDirectory) | Out-Null
}

function Write-Evidence {
    param($Value)
    $path = Join-Path $script:EvidenceDirectory ('dbadmin-' + $Action.ToLowerInvariant() + '.json')
    Assert-NoLinkedAncestors -Path $path
    [IO.File]::WriteAllText($path, (ConvertTo-Json -InputObject $Value -Depth 15) + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
}

function New-Summary {
    param([string]$Status)
    return [ordered]@{
        kit_version = '0.1'
        action = $Action
        result = 'PASS'
        status = $Status
        time_utc = [DateTime]::UtcNow.ToString('o')
        compose_project = $script:ProjectName
        compose_version = $script:ComposeVersion
        data_volume = $script:DataVolumeName
        port = $Port
        url = $script:AdminUrl
    }
}

try {
    if ($Port -eq 8080) { throw 'El puerto 8080 esta reservado para React. Usa 8081 o indica -Port con otro puerto libre.' }
    # HF1: resolver parametros omitidos en el cuerpo, nunca al enlazar param().
    if (-not $PSBoundParameters.ContainsKey('ProjectPath')) {
        $ProjectPath = $PSScriptRoot
        if ([string]::IsNullOrWhiteSpace($ProjectPath) -and -not [string]::IsNullOrWhiteSpace($PSCommandPath)) { $ProjectPath = Split-Path -Parent $PSCommandPath }
        if ([string]::IsNullOrWhiteSpace($ProjectPath)) { throw 'No se pudo determinar la carpeta del script. Indica -ProjectPath.' }
    }
    $script:ProjectDirectory = Get-FullDirectoryPath -Path $ProjectPath
    if (-not (Test-Path -LiteralPath $script:ProjectDirectory -PathType Container)) { throw 'ProjectPath no es un directorio existente.' }
    if (-not $PSBoundParameters.ContainsKey('PrivatePath')) {
        $parent = [IO.Directory]::GetParent($script:ProjectDirectory)
        if ($null -eq $parent) { throw 'El proyecto debe ser una carpeta, no la raiz del disco.' }
        $PrivatePath = Join-Path $parent.FullName ((Split-Path -Leaf $script:ProjectDirectory) + '-docker-private')
    }
    $script:PrivateDirectory = Get-FullDirectoryPath -Path $PrivatePath
    if ($script:PrivateDirectory.Equals($script:ProjectDirectory, $script:PathComparison) -or $script:PrivateDirectory.StartsWith($script:ProjectDirectory + [IO.Path]::DirectorySeparatorChar, $script:PathComparison) -or $script:PrivateDirectory -eq [IO.Path]::GetPathRoot($script:PrivateDirectory)) { throw 'PrivatePath debe ser la carpeta privada original, fuera del proyecto; por ejemplo C:\Dev\supply-docker-private.' }
    Assert-NoLinkedAncestors -Path $script:ProjectDirectory
    Assert-NoLinkedAncestors -Path $script:PrivateDirectory
    $script:ComposeArguments = @('compose', '--project-directory', $script:ProjectDirectory)
    foreach ($name in @('docker-compose.yml', 'compose.supply-db.yml', 'compose.supply-dev.yml', 'compose.supply-dbadmin.yml')) {
        $path = Join-Path $script:ProjectDirectory $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw ('Falta el archivo requerido: {0}.' -f $name) }
        $script:ComposeArguments += @('-f', $path)
    }
    $script:ComposeArguments += @('--profile', 'dev', '--profile', 'db-admin')
    $script:EvidenceDirectory = Join-Path $script:PrivateDirectory 'evidence'
    $script:AdminUrl = 'http://127.0.0.1:{0}/' -f $Port
    [Environment]::SetEnvironmentVariable('SUPPLYFLOW_LOCAL_PRIVATE_DIR', $script:PrivateDirectory, 'Process')
    [Environment]::SetEnvironmentVariable('SUPPLYFLOW_DBADMIN_PORT', [string]$Port, 'Process')
    Assert-LocalLinuxDocker
    Initialize-ComposeIdentity

    if ($Action -eq 'Status') {
        $summary = New-Summary -Status 'STATUS_ONLY'
        $summary['services'] = Get-FoundationSnapshot
        $summary['phpmyadmin'] = Get-ServiceSnapshot -Name 'phpmyadmin'
        $summary['binding_matches_requested_port'] = Test-AdminBinding -Snapshot $summary['phpmyadmin']
        $summary['note'] = 'Solo consulta de estado; no modifica contenedores ni archivos. Usa el mismo -Port que en Start si lo cambiaste.'
    }
    else {
        Open-PrivateLock
        $script:Before = Get-FoundationSnapshot
        if ($Action -eq 'Start') {
            Assert-DatabaseHealthy -Snapshot $script:Before['db']
            $existingAdmin = Get-ServiceSnapshot -Name 'phpmyadmin'
            Assert-PortAvailable -ExistingAdmin $existingAdmin
            Write-Host 'Descargando e iniciando solo phpmyadmin; db, api, frontend y web conservan sus contenedores.'
            Invoke-ComposeChecked -Arguments @('pull', 'phpmyadmin')
            Invoke-ComposeChecked -Arguments @('up', '-d', '--no-deps', '--no-build', '--wait', '--wait-timeout', '120', 'phpmyadmin')
            $admin = Get-ServiceSnapshot -Name 'phpmyadmin'
            if ($null -eq $admin -or $admin.state -ne 'running' -or $admin.health -ne 'healthy' -or -not (Test-AdminBinding -Snapshot $admin)) { throw 'phpmyadmin no esta running/healthy con el puerto local esperado.' }
            $http = Test-AdminLoginPage
            $summary = New-Summary -Status 'DBADMIN_READY'
            $summary['http'] = $http
            $summary['note'] = 'Formulario de acceso disponible. Inicia sesion manualmente con la cuenta SELECT existente supplyflow_api_local.'
        }
        else {
            # No se exige health de db/api/frontend/web para cerrar la interfaz.
            $null = Get-ServiceSnapshot -Name 'phpmyadmin'
            Invoke-ComposeChecked -Arguments @('stop', 'phpmyadmin')
            $admin = Get-ServiceSnapshot -Name 'phpmyadmin'
            if ($null -ne $admin -and $admin.state -notin @('exited', 'created', 'dead')) { throw 'phpmyadmin no quedo detenido.' }
            $summary = New-Summary -Status 'DBADMIN_STOPPED'
        }
        $script:After = Get-FoundationSnapshot
        $checks = Get-PreservationChecks -Before $script:Before -After $script:After
        if (-not $checks['db_container_preserved'] -or -not $checks['db_volume_preserved'] -or -not $checks['application_containers_preserved']) { throw 'Cambio un contenedor existente o el volumen de db durante la accion. Revisa la evidencia; este complemento solo opera phpmyadmin.' }
        if ($Action -eq 'Start') { Assert-DatabaseHealthy -Snapshot $script:After['db'] }
        $summary['phpmyadmin'] = $admin
        $summary['before'] = $script:Before
        $summary['after'] = $script:After
        $summary['checks'] = $checks
        Write-Evidence -Value $summary
    }
    Write-Host 'Resumen sin credenciales:'
    Write-Output (ConvertTo-Json -InputObject $summary -Depth 15)
}
catch {
    $script:ExitCode = 1
    $failure = [ordered]@{ kit_version = '0.1'; action = $Action; result = 'FAIL'; time_utc = [DateTime]::UtcNow.ToString('o'); message = $_.Exception.Message }
    if ($null -ne $script:Before) {
        $failure['before'] = $script:Before
        try {
            if ($null -eq $script:After) { $script:After = Get-FoundationSnapshot }
            $failure['after'] = $script:After
            $failure['checks'] = Get-PreservationChecks -Before $script:Before -After $script:After
        }
        catch { $failure['preservation_verified'] = $false }
    }
    if ($Action -ne 'Status' -and $null -ne $script:LockStream -and (Test-Path -LiteralPath $script:EvidenceDirectory -PathType Container)) {
        try { Write-Evidence -Value $failure }
        catch { Write-Host 'No se pudo guardar la evidencia de fallo; revisa los permisos privados.' -ForegroundColor Yellow }
    }
    Write-Host ('ERROR: ' + $failure['message']) -ForegroundColor Red
    Write-Output (ConvertTo-Json -InputObject $failure -Depth 15)
}
finally {
    if ($null -ne $script:LockStream) { $script:LockStream.Dispose() }
    [Environment]::SetEnvironmentVariable('SUPPLYFLOW_LOCAL_PRIVATE_DIR', $previousPrivate, 'Process')
    [Environment]::SetEnvironmentVariable('SUPPLYFLOW_DBADMIN_PORT', $previousPort, 'Process')
}
exit $script:ExitCode
