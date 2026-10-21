# ==============================================================================
# Script de Publicacao Automatica Direta na Hostinger via SSH/SCP
# Alvo: https://lynxems.com.br
# Servidor: 89.116.115.59:65002 (u494795077)
# Chave: $HOME\.ssh\id_hostinger_lynx
# ==============================================================================
param(
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  SINCO ERP - Publicacao Direta Hostinger (SSH/SCP)    " -ForegroundColor Cyan
Write-Host "  Dominio Oficial: https://lynxems.com.br             " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$sshKey = Join-Path $HOME ".ssh\id_hostinger_lynx"
$sshHost = "89.116.115.59"
$sshPort = "65002"
$sshUser = "u494795077"
$remoteAppRoot = "/home/u494795077/domains/lynxems.com.br/public_html"
$remoteStagingTar = "/home/u494795077/deploy_sinco_temp.tar.gz"

if (-not (Test-Path $sshKey)) {
    Write-Error "Chave SSH nao encontrada em $sshKey! Verifique suas credenciais."
    exit 1
}

# 1. Compilacao e Empacotamento
if (-not $SkipBuild) {
    Write-Host "`n[1/5] Compilando frontend e preparando arquivos de producao..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File .\gerar-producao-hostinger.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha na geracao do pacote de producao!"
        exit 1
    }
} else {
    Write-Host "`n[1/5] Pulando etapa de compilacao (-SkipBuild informado)..." -ForegroundColor Gray
}

$tarPath = "lynxems-producao.tar.gz"
Write-Host "Compactando pacote limpo com tar.exe..." -ForegroundColor Yellow
if (Test-Path $tarPath) { Remove-Item $tarPath -Force }
& tar.exe -czf $tarPath -C producao-hostinger .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erro ao compactar com tar.exe!"
    exit 1
}

$tarSizeMb = [math]::Round(((Get-Item $tarPath).Length / 1MB), 2)
Write-Host "Pacote pronto: $tarPath ($tarSizeMb MB)" -ForegroundColor Green

# 2. Upload Seguro via SCP (para staging temporario fora dos subdominios)
Write-Host "`n[2/5] Enviando $tarPath para a Hostinger via SCP (porta $sshPort)..." -ForegroundColor Yellow
& scp -i $sshKey -P $sshPort $tarPath "${sshUser}@${sshHost}:${remoteStagingTar}"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erro ao transferir arquivo para a Hostinger!"
    exit 1
}
Write-Host "Upload concluido com sucesso!" -ForegroundColor Green

# 3. Extracao Segura no Dominio Raiz (sem afetar subdominios)
Write-Host "`n[3/5] Extraindo pacote na raiz do dominio (preservando subpastas de subdominios)..." -ForegroundColor Yellow
$remoteCmd = "export PATH=/opt/alt/alt-nodejs20/root/usr/bin:`$PATH && echo '==> Extraindo com tar na public_html...' && tar -xzf $remoteStagingTar -C $remoteAppRoot && rm -f $remoteStagingTar && echo '==> Verificando dependencias do backend...' && cd $remoteAppRoot/server && npm install --omit=dev --ignore-scripts && echo '==> Acionando reinicio imediato do Node.js...' && mkdir -p $remoteAppRoot/tmp && touch $remoteAppRoot/tmp/restart.txt && echo '==> Processo concluido com sucesso!'"

& ssh -i $sshKey -p $sshPort "${sshUser}@${sshHost}" "$remoteCmd"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erro ao executar extracao e reinicio no servidor remoto!"
    exit 1
}

# 4. Aguardar reinicio do LiteSpeed Node.js
Write-Host "`n[4/5] Aguardando reinicio do Node.js na nuvem (5 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 5. Verificacao de Saude e Endpoints em Producao
Write-Host "`n[5/5] Validando saude da API em https://lynxems.com.br..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://lynxems.com.br/api/health" -Method Get -TimeoutSec 15
    Write-Host "Status: $($health.status) | Uptime: $([math]::Round($health.uptime, 2))s | Timestamp: $($health.timestamp)" -ForegroundColor Green
    
    if ($health.uptime -lt 120) {
        Write-Host "[OK] O servidor Node.js reiniciou e carregou o novo codigo com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "[AVISO] Uptime reportado foi $($health.uptime)s." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERRO] Erro ao consultar /api/health: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  APLICACAO PUBLICADA COM SUCESSO NA HOSTINGER!       " -ForegroundColor Green
Write-Host "  Acesse: https://lynxems.com.br                      " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
