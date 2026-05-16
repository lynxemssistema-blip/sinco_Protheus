# MetalFisa Deployment Sync Script for Externo
# Updates SincoMetalfisa-externo with latest changes

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MetalFisa - Syncing Externo Deployment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$root = "C:\Users\adm\Desktop\MetalFisa Anty"
$serverSrc = Join-Path $root "server"
$serverDest = Join-Path $root "SincoMetalfisa-externo\server"
$clientDist = Join-Path $root "client\dist"
$clientDest = Join-Path $root "SincoMetalfisa-externo\client\dist"

# Ensure directories exist
if (!(Test-Path $serverDest)) { New-Item -ItemType Directory -Force -Path $serverDest | Out-Null }
if (!(Test-Path $clientDest)) { New-Item -ItemType Directory -Force -Path $clientDest | Out-Null }

# 1. Sync Backend root files (index.js, db.js, package.json, package-lock.json, .env)
Write-Host "Updating Backend root files..." -ForegroundColor Yellow
robocopy "$serverSrc" "$serverDest" index.js db.js package.json package-lock.json .env /IS /IT /NJH /NJS /NDL /NFL /NC /NS

# 2. Mirror code subdirectories
Write-Host "Mirroring Backend subdirectories..." -ForegroundColor Yellow
$codeDirs = @("routes", "middlewares", "services", "util", "utils", "config", "sql", "public", "scripts")
foreach ($dir in $codeDirs) {
    $srcDir = Join-Path $serverSrc $dir
    $destDir = Join-Path $serverDest $dir
    if (Test-Path $srcDir) {
        robocopy "$srcDir" "$destDir" /MIR /IS /IT /XF *.log *.txt *.xlsx /NJH /NJS /NDL /NFL /NC /NS
    }
}

# 3. Sync Frontend Build (Production)
Write-Host "Updating Frontend Build..." -ForegroundColor Yellow
if (Test-Path "$clientDist") {
    robocopy "$clientDist" "$clientDest" /E /MIR /NJH /NJS /NDL /NFL /NC /NS
} else {
    Write-Host "Warning: client/dist not found. Run 'npm run build' in client folder first." -ForegroundColor Red
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Sync Completed Successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
