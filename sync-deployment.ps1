# MetalFisa Deployment Sync Script
# Updates linux-deployment with latest changes

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MetalFisa - Syncing Linux Deployment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$root = Get-Location
$serverSrc = Join-Path $root "server"
$serverDest = Join-Path $root "linux-deployment\server"
$clientDist = Join-Path $root "client\dist"
$clientDest = Join-Path $root "linux-deployment\client\dist"

# 1. Sync Backend root files (index.js, db.js, package.json, package-lock.json)
Write-Host "Updating Backend root files..." -ForegroundColor Yellow
# /IS = Include Same (força cópia mesmo que pareça igual), /IT = Include Tweaked
robocopy "$serverSrc" "$serverDest" index.js db.js package.json package-lock.json /IS /IT /NJH /NJS /NDL /NFL /NC /NS

# 2. Mirror code subdirectories — /MIR + /IS + /IT garante sincronia completa de conteúdo
Write-Host "Mirroring Backend subdirectories..." -ForegroundColor Yellow
$codeDirs = @("routes", "middlewares", "services", "util", "utils", "config", "sql", "public", "scripts", "templates")
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
