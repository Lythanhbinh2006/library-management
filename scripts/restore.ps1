param([Parameter(Mandatory=$true)][string]$InputFile)
$ErrorActionPreference = 'Stop'
$answer = Read-Host 'Restore replaces current library data. Type RESTORE to continue'
if ($answer -cne 'RESTORE') { throw 'Cancelled.' }
Get-Content -Raw -Encoding Byte $InputFile | docker compose exec -T postgres pg_restore --clean --if-exists --no-owner -U library_admin -d library
