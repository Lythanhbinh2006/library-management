param([string]$Output = "backups/library-$(Get-Date -Format yyyyMMdd-HHmmss).dump")
$ErrorActionPreference = 'Stop'
$parent = Split-Path -Parent $Output
New-Item -ItemType Directory -Force -Path $parent | Out-Null
docker compose exec -T postgres pg_dump -Fc -U library_admin -d library | Set-Content -Encoding Byte -Path $Output
Write-Host "Backup written to $Output"
