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
robocopy "$serverSrc" "$serverDest" index.js db.js package.json package-lock.json /NJH /NJS /NDL /NFL /NC /NS

# 2. Mirror code subdirectories — /MIR garante que arquivos novos e deletados ficam em sincronia
Write-Host "Mirroring Backend subdirectories..." -ForegroundColor Yellow
$codeDirs = @("routes", "middlewares", "services", "util", "utils", "config", "sql", "public")
foreach ($dir in $codeDirs) {
    $srcDir = Join-Path $serverSrc $dir
    $destDir = Join-Path $serverDest $dir
    if (Test-Path $srcDir) {
        robocopy "$srcDir" "$destDir" /MIR /XF *.log *.txt *.xlsx /NJH /NJS /NDL /NFL /NC /NS
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
