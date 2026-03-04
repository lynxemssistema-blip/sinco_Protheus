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

# 1. Sync Backend
Write-Host "Updating Backend..." -ForegroundColor Yellow
# Exclude sensitive and dev files
robocopy "$serverSrc" "$serverDest" /E /XF .env .env.example *.log *.txt *.xlsx /XD node_modules tmp scripts /NJH /NJS /NDL /NFL /NC /NS

# 2. Sync Frontend Build (Production)
Write-Host "Updating Frontend Build..." -ForegroundColor Yellow
if (Test-Path "$clientDist") {
    robocopy "$clientDist" "$clientDest" /E /MIR /NJH /NJS /NDL /NFL /NC /NS
} else {
    Write-Host "Warning: client/dist not found. Run 'npm run build' in client folder first." -ForegroundColor Red
}

# 3. Cleanup Backend Root (Remove test/debug scripts)
Write-Host "Cleaning up non-essential scripts..." -ForegroundColor Yellow
Get-ChildItem -Path "$serverDest" -File | Where-Object { 
    $_.Name -ne "index.js" -and 
    $_.Name -ne "db.js" -and 
    $_.Name -ne "package.json" -and 
    $_.Name -ne "package-lock.json" -and 
    $_.Name -ne ".env" -and 
    $_.Name -ne ".env.example" 
} | Remove-Item -Force

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Sync Completed Successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
