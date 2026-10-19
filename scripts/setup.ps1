# Sinh file .env với mật khẩu ngẫu nhiên mạnh (Windows PowerShell).
# Chạy:  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (Test-Path ".env") {
    Write-Host "[setup] .env da ton tai - giu nguyen. Xoa file nay neu muon sinh lai."
    exit 0
}

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
function New-Hex([int]$bytes) {
    $b = New-Object byte[] $bytes
    $rng.GetBytes($b)
    return (($b | ForEach-Object { $_.ToString("x2") }) -join "")
}
function New-Pw { return "Lib-" + (New-Hex 10) + "-Q7x" }

$adminPw   = New-Pw
$pgadminPw = New-Pw
$grafanaPw = New-Pw

$lines = @(
    "POSTGRES_PASSWORD=$(New-Hex 24)",
    "APP_DB_PASSWORD=$(New-Hex 24)",
    "SESSION_SECRET=$(New-Hex 32)",
    "ADMIN_USERNAME=admin",
    "ADMIN_PASSWORD=$adminPw",
    "PGADMIN_EMAIL=admin@example.com",
    "PGADMIN_PASSWORD=$pgadminPw",
    "SERVER_NAME=localhost",
    "HTTP_PORT=80",
    "HTTPS_PORT=443",
    "ADMIN_BIND=127.0.0.1",
    ""
)
$path = Join-Path (Get-Location) ".env"
[System.IO.File]::WriteAllText($path, ($lines -join "`n"), (New-Object System.Text.UTF8Encoding $false))

Write-Host "[setup] Da tao .env. Tai khoan dang nhap:"
Write-Host "  Website  : admin / $adminPw"
Write-Host "  pgAdmin  : admin@example.com / $pgadminPw"
Write-Host "Tiep theo: docker compose up -d --build"
