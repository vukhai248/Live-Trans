# Live-Trans Check Script
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ExtDir = Join-Path $Root "extension"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  LIVE-TRANS PROJECT HEALTH CHECK" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Push-Location $ExtDir
try {
    Write-Host ""
    Write-Host "Dang chay toan bo kiem thu (typecheck + lint + tests)..." -ForegroundColor Yellow
    npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw "Check failed" }
    Write-Host ""
    Write-Host "Tat ca kiem tra deu DAT (PASS) 100%!" -ForegroundColor Green
} finally {
    Pop-Location
}
