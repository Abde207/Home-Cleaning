param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('validate', 'generate', 'status', 'deploy', 'seed')]
    [string]$Command
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$schemaEngine = Join-Path $projectRoot 'node_modules/@prisma/engines/schema-engine-windows.exe'
$queryEngine = Join-Path $projectRoot 'node_modules/@prisma/engines/query_engine-windows.dll.node'
if (!(Test-Path -LiteralPath $schemaEngine) -or !(Test-Path -LiteralPath $queryEngine)) {
    throw 'Installed Windows Prisma engines are missing. Run npm ci before using this helper.'
}

# Use the engines from the installed lockfile dependencies when network access is unavailable.
# Explicit caller overrides take precedence; restore the environment after the command.
$previousSchemaEngine = $env:PRISMA_SCHEMA_ENGINE_BINARY
$previousQueryEngine = $env:PRISMA_QUERY_ENGINE_LIBRARY
Push-Location $projectRoot
try {
    if (!$previousSchemaEngine) { $env:PRISMA_SCHEMA_ENGINE_BINARY = $schemaEngine }
    if (!$previousQueryEngine) { $env:PRISMA_QUERY_ENGINE_LIBRARY = $queryEngine }
    & npm.cmd run "prisma:$Command"
    if ($LASTEXITCODE -ne 0) { throw "Prisma $Command failed (exit $LASTEXITCODE)." }
} finally {
    $env:PRISMA_SCHEMA_ENGINE_BINARY = $previousSchemaEngine
    $env:PRISMA_QUERY_ENGINE_LIBRARY = $previousQueryEngine
    Pop-Location
}
