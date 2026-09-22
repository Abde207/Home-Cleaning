param([string]$Distribution = 'OpenClawGateway')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
# Uses stdin because the existing WSL distro intentionally disables drive mounts.
Get-Content -Raw scripts/start-wsl-services.sh | wsl -d $Distribution -u root -- sh -s
if ($LASTEXITCODE -ne 0) { throw 'WSL service startup failed' }
if (Test-Path -LiteralPath .local/bootstrap.sql) {
    Get-Content -Raw .local/bootstrap.sql | wsl -d $Distribution -u root -- runuser -u postgres -- psql -p 55432 -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Database bootstrap failed' }
    Remove-Item -LiteralPath .local/bootstrap.sql
}
