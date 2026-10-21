$ErrorActionPreference = 'Stop'
Get-ChildItem -Path "$PSScriptRoot\..\db\migrations" -Filter '*.sql' | Sort-Object Name | ForEach-Object {
  Write-Host "Applying $($_.Name)"
  Get-Content -Raw $_.FullName | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U library_admin -d library
}
Write-Host 'Migrations complete.'
