# Restart Linux Server Script
param([string]$ServerUrl = "192.168.1.77")

Write-Host "Connecting to $ServerUrl to restart PM2..." -ForegroundColor Yellow
$user = "sinco"
$keyFile = "C:\Users\adm\.ssh\id_rsa"

# If ssh key exists
if (Test-Path $keyFile) {
    ssh -i $keyFile $user@$ServerUrl "cd /var/www/metalfisa/server && pm2 restart all"
} else {
    Write-Host "Warning: No SSH key found at $keyFile. Ensure SSH config is proper." -ForegroundColor Red
    # try direct ssh
    ssh $user@$ServerUrl "cd /var/www/metalfisa/server && pm2 restart all"
}

Write-Host "Done!" -ForegroundColor Green
