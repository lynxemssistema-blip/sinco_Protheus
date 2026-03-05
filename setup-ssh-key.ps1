# setup-ssh-key.ps1
# Instala a chave SSH publica no servidor para permitir deploy sem senha

$SERVER = "192.168.1.77"
$USER = "sinco"
$PUB_KEY = Get-Content "C:\Users\adm\.ssh\id_rsa.pub"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Configurando chave SSH no servidor" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Servidor: $USER@$SERVER" -ForegroundColor Yellow
Write-Host "Voce precisara digitar a senha UMA UNICA VEZ: Metal1405" -ForegroundColor Yellow
Write-Host ""

# Instala a chave publica no servidor
$CMD = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$PUB_KEY' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'Chave instalada com sucesso!'"

ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no "${USER}@${SERVER}" $CMD

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Chave SSH configurada!" -ForegroundColor Green
Write-Host "  Proximos deploys serao automaticos." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
