# Live-Trans Chrome Extension Build & Zip Script
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ExtDir = Join-Path $Root "extension"
$DistDir = Join-Path $Root "dist"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  LIVE-TRANS EXTENSION BUILD & ZIPPER" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir | Out-Null
}

Push-Location $ExtDir
try {
    Write-Host "[1/2] Dang kiem tra ma nguon va bien dich..." -ForegroundColor Yellow
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }

    Write-Host "[2/2] Dang dong goi .zip..." -ForegroundColor Yellow
    npm.cmd run zip
    if ($LASTEXITCODE -ne 0) { throw "Zip failed" }

    $ZipFiles = Get-ChildItem -Path (Join-Path $ExtDir ".output") -Filter "*.zip"
    if ($ZipFiles.Count -gt 0) {
        $LatestZip = $ZipFiles[0].FullName
        $TargetZip = Join-Path $DistDir "live-trans-extension.zip"
        Copy-Item -Path $LatestZip -Destination $TargetZip -Force
        Write-Host ""
        Write-Host "Dong goi thanh cong! File zip san sang tai:" -ForegroundColor Green
        Write-Host " -> $TargetZip" -ForegroundColor Cyan
    }
} finally {
    Pop-Location
}
