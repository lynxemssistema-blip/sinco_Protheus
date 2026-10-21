# Script para compilar o frontend e gerar o pacote de produção pronto para Hostinger
# Destino: ./producao-hostinger e ./lynxems-producao.zip

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  SINCO ERP - Gerador do Pacote de Produção Hostinger" -ForegroundColor Cyan
Write-Host "  Domínio Alvo: https://lynxems.com.br" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$root = Get-Location
$dest = Join-Path $root "producao-hostinger"
$clientDir = Join-Path $root "client"
$serverDir = Join-Path $root "server"
$zipOutput = Join-Path $root "lynxems-producao.zip"

# 1. Limpar / criar pasta de destino
Write-Host "`n[1/6] Preparando diretório de destino: $dest..." -ForegroundColor Yellow
if (Test-Path $dest) {
    Remove-Item -Path $dest -Recurse -Force
}
New-Item -ItemType Directory -Path $dest | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dest "server") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dest "public") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dest "client\dist") | Out-Null

# 2. Compilar Frontend com Vite
Write-Host "`n[2/6] Compilando frontend React (npm run build)..." -ForegroundColor Yellow
Push-Location $clientDir
try {
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0) {
        throw "Erro na compilação do frontend!"
    }
} finally {
    Pop-Location
}

# 3. Copiar Frontend compilado
Write-Host "`n[3/6] Copiando arquivos compilados do cliente..." -ForegroundColor Yellow
$clientDist = Join-Path $clientDir "dist"

# Copia para client/dist e para public/
robocopy "$clientDist" (Join-Path $dest "client\dist") /E /NJH /NJS /NDL /NFL /NC /NS
robocopy "$clientDist" (Join-Path $dest "public") /E /NJH /NJS /NDL /NFL /NC /NS

# Copia TODOS os arquivos e pastas estáticas de client/dist para a raiz de producao-hostinger (para LiteSpeed servir direto)
robocopy "$clientDist" "$dest" /E /XF *.zip *.log /NJH /NJS /NDL /NFL /NC /NS

# 4. Copiar Backend limpo (sem logs, sem node_modules, sem chaves privadas)
Write-Host "`n[4/6] Copiando backend e dependências limpas..." -ForegroundColor Yellow
$serverDest = Join-Path $dest "server"

# Arquivos raiz do server (SEM copiar .env de desenvolvimento)
robocopy "$serverDir" "$serverDest" index.js db.js package.json package-lock.json /IS /IT /NJH /NJS /NDL /NFL /NC /NS

# Subpastas de código do backend (incluindo util, utils, migrations, etc.)
$codeDirs = @("routes", "middlewares", "services", "util", "utils", "config", "sql", "public", "scripts", "templates", "migrations")
foreach ($d in $codeDirs) {
    $srcSub = Join-Path $serverDir $d
    $destSub = Join-Path $serverDest $d
    if (Test-Path $srcSub) {
        robocopy "$srcSub" "$destSub" /MIR /IS /IT /XF *.log *.txt *.xlsx /NJH /NJS /NDL /NFL /NC /NS
    }
}

# Gerar .env.example e .env de produção seguro para a Hostinger
$envExample = @"
# =====================================================================
# CONFIGURACAO DE PRODUCAO HOSTINGER (https://lynxems.com.br)
# =====================================================================
PORT=3000
NODE_ENV=production
APP_URL=https://lynxems.com.br

# Banco de Dados MySQL Remoto (Hostinger)
MYSQL_HOST=193.203.175.68
MYSQL_USER=u494795077_sinco
MYSQL_PASS=Sinco2026!*
MYSQL_DB=u494795077_SINCO

# Autenticação e Segurança
JWT_SECRET=lynxems_security_key_2026

# Google Gemini API
GEMINI_API_KEY=AIzaSyCbPG50oJfcQCSHqLacuZIjh_iPN_AEXGU

# Integrações (WhatsApp / Evolution)
EVOLUTION_API_URL=https://evo.lynxems.com.br
EVOLUTION_API_KEY=883217421C2C-4849-B02B-438A6C49200F
EVOLUTION_INSTANCE=LynxEMS

# SMTP Oficial Hostinger (SINCO / Lynx ERP)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=suporte@lynxems.com.br
SMTP_PASS=10207597Rdv*
SMTP_FROM="SINCO / Lynx" <suporte@lynxems.com.br>

# Desativação de bancos legados on-prem Lynx EMS
ENABLE_PROTHEUS=false
ENABLE_FIREBIRD=false
"@
Set-Content -Path (Join-Path $serverDest ".env.example") -Value $envExample -Encoding UTF8

# Criar .env de producao limpo na pasta server
Set-Content -Path (Join-Path $serverDest ".env") -Value $envExample -Encoding UTF8

# 5. Gerar arquivos de inicialização da Hostinger
Write-Host "`n[5/6] Gerando arquivos de entrada e instruções para Hostinger..." -ForegroundColor Yellow

# app.js
$appJs = @"
// Ponto de entrada oficial para Hospedagem Hostinger (Phusion Passenger / Node.js)
require('./server/index.js');
"@
Set-Content -Path (Join-Path $dest "app.js") -Value $appJs -Encoding UTF8

# package.json da raiz
$pkgJson = @"
{
  "name": "lynxems-sinco-erp",
  "version": "1.0.0",
  "description": "SINCO ERP - Producao Hostinger https://lynxems.com.br",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "postinstall": "cd server && npm install --omit=dev"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
"@
Set-Content -Path (Join-Path $dest "package.json") -Value $pkgJson -Encoding UTF8

# ecosystem.config.js (para PM2 caso utilize terminal Hostinger)
$ecosystem = @"
module.exports = {
  apps: [
    {
      name: 'sinco-backend',
      script: 'index.js',
      cwd: './server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
"@
Set-Content -Path (Join-Path $dest "ecosystem.config.js") -Value $ecosystem -Encoding UTF8

# Sinalizador para Phusion Passenger recarregar automaticamente o Node.js na extração
$tmpDir = Join-Path $dest "tmp"
if (-not (Test-Path $tmpDir)) {
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
}
Set-Content -Path (Join-Path $tmpDir "restart.txt") -Value ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss")) -Encoding UTF8

# Manual de Publicação Seguro
$instrucoes = @"
========================================================================
  SINCO ERP - GUIA DE PUBLICACAO NA HOSTINGER (https://lynxems.com.br)
========================================================================

⚠️ AVISO CRITICO SOBRE SUBDOMINIOS:
Na Hostinger, os subdominios (ex: crm, izaque, apontador, metalfisa, etc.)
ficam localizados dentro de subpastas da 'public_html/'.
NUNCA apague a pasta 'public_html' inteira e NUNCA execute comandos dentro
das pastas dos subdominios!
O dominio raiz deve apenas substituir seus proprios arquivos:
- app.js
- package.json
- index.html
- .htaccess
- server/
- assets/

------------------------------------------------------------------------
PASSO A PASSO NO HPANEL DA HOSTINGER:
------------------------------------------------------------------------
1. Faça backup da public_html atual antes de extrair.
2. Envie o arquivo lynxems-producao.zip para a public_html de lynxems.com.br.
3. Extraia o conteúdo diretamente na raiz da aplicação.
4. No hPanel, vá em 'Avançado' -> 'Node.js':
   - Versão do Node.js: 20.x (ou 18.x)
   - Modo da Aplicação: Production
   - Arquivo de inicialização: app.js
   - Diretório da Aplicação: / ou pasta configurada
5. No terminal ou painel, dentro da pasta server:
   cd server && npm install --omit=dev
6. Inicie / Reinicie a aplicação Node.js.
7. Acesse no navegador: https://lynxems.com.br
========================================================================
"@
Set-Content -Path (Join-Path $dest "INSTRUCOES_PUBLICACAO_HOSTINGER.txt") -Value $instrucoes -Encoding UTF8

# 6. Gerar arquivo .ZIP pronto para upload
Write-Host "`n[6/6] Compactando pacote de produção em $zipOutput..." -ForegroundColor Yellow
if (Test-Path $zipOutput) {
    Remove-Item -Path $zipOutput -Force
}
Compress-Archive -Path "$dest\*" -DestinationPath $zipOutput -CompressionLevel Optimal

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  PACOTE DE PRODUCAO E ZIP GERADOS COM SUCESSO!" -ForegroundColor Green
Write-Host "  Pasta: $dest" -ForegroundColor Green
Write-Host "  Arquivo ZIP: $zipOutput" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
