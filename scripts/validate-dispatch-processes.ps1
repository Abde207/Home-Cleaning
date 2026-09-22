$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$bridge = Join-Path $workspace ('.local\dispatch-process-' + [guid]::NewGuid().ToString('N'))
$resolvedRoot = [IO.Path]::GetFullPath($workspace).TrimEnd('\') + '\'
$resolvedBridge = [IO.Path]::GetFullPath($bridge)
if (!$resolvedBridge.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe validation directory' }
New-Item -ItemType Directory -Path $bridge -Force | Out-Null
$node = (Get-Command node).Source
$previousDatabaseUrl = $env:DATABASE_URL
$previousBridge = $env:DISPATCH_EXTERNAL_WORKERS_DIR
$children = @{}
$success = $false
try {
    $env:DISPATCH_EXTERNAL_WORKERS_DIR = $bridge
    $runner = Start-Process -FilePath $node -ArgumentList @('--env-file=.env', 'scripts/test-backend-direct.mjs', 'dispatch.process.validation.ts') `
        -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bridge 'runner.out') `
        -RedirectStandardError (Join-Path $bridge 'runner.err') -PassThru
    $deadline = (Get-Date).AddMinutes(3)
    while ((Get-Date) -lt $deadline) {
        $runner.Refresh()
        $schemaFile = Join-Path $bridge 'schema.txt'
        if (Test-Path -LiteralPath $schemaFile) {
            $schema = (Get-Content -LiteralPath $schemaFile -Raw).Trim()
            if ($schema -notmatch '^test_[a-f0-9]{32}$') { throw 'Unsafe validation schema' }
            $line = Get-Content -LiteralPath (Join-Path $workspace '.env') | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
            if (!$line) { throw 'DATABASE_URL missing from .env' }
            $baseUrl = $line.Substring('DATABASE_URL='.Length).Trim([char[]]@('"', "'"))
            $uri = [uri]$baseUrl
            if ($uri.Host -notin @('127.0.0.1', 'localhost')) { throw 'Validation requires local PostgreSQL' }
            if ($baseUrl -match 'schema=[^&]*') { $env:DATABASE_URL = $baseUrl -replace 'schema=[^&]*', "schema=$schema" }
            elseif ($baseUrl.Contains('?')) { $env:DATABASE_URL = "$baseUrl&schema=$schema" }
            else { $env:DATABASE_URL = "$baseUrl`?schema=$schema" }
        }
        foreach ($startFile in @(Get-ChildItem -LiteralPath $bridge -Filter 'start-*.json' -File -ErrorAction SilentlyContinue)) {
            $spec = Get-Content -LiteralPath $startFile.FullName -Raw | ConvertFrom-Json
            $id = [string]$spec.id
            if ($id -notmatch '^[a-f0-9]{32}$' -or $children.ContainsKey($id)) { continue }
            if (!$env:DATABASE_URL) { continue }
            $env:DISPATCH_PROCESS_TEST_ID = $id
            $env:DISPATCH_PROCESS_TEST_MODE = [string]$spec.mode
            $env:DISPATCH_WORKER_ENABLED = 'true'
            $env:NODE_ENV = if ($spec.timer) { 'development' } else { 'test' }
            $children[$id] = Start-Process -FilePath $node -ArgumentList @('--env-file=.env', 'backend/nestjs/test/helpers/dispatch-worker-process.mjs') `
                -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bridge "worker-$id.out") `
                -RedirectStandardError (Join-Path $bridge "worker-$id.err") -PassThru
        }
        foreach ($killFile in @(Get-ChildItem -LiteralPath $bridge -Filter 'kill-*.txt' -File -ErrorAction SilentlyContinue)) {
            $id = $killFile.BaseName.Substring('kill-'.Length)
            $killedFile = Join-Path $bridge "killed-$id.txt"
            if ($children.ContainsKey($id) -and !(Test-Path -LiteralPath $killedFile)) {
                Stop-Process -Id $children[$id].Id -Force -ErrorAction SilentlyContinue
                Set-Content -LiteralPath $killedFile -Value 'killed'
            }
        }
        if ($runner.HasExited) { break }
        Start-Sleep -Milliseconds 100
    }
    $runner.Refresh()
    if (!$runner.HasExited) { Stop-Process -Id $runner.Id -Force; throw 'Separate-process validation timed out' }
    Get-Content -LiteralPath (Join-Path $bridge 'runner.out')
    Get-Content -LiteralPath (Join-Path $bridge 'runner.err')
    if ($runner.ExitCode -ne 0) { throw "Separate-process validation exited $($runner.ExitCode). Logs: $bridge" }
    $success = $true
} finally {
    foreach ($child in $children.Values) { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue }
    $env:DATABASE_URL = $previousDatabaseUrl
    $env:DISPATCH_EXTERNAL_WORKERS_DIR = $previousBridge
    if ($success -and $resolvedBridge.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedBridge -Recurse -Force
    }
}
