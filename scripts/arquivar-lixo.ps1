$root = Split-Path -Parent $PSScriptRoot
$arq = Join-Path $root '_arquivo_morto'
New-Item -ItemType Directory -Force -Path $arq | Out-Null

function Move-Safe($file, $subdir) {
    $dest = Join-Path $arq $subdir
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Move-Item -LiteralPath $file.FullName -Destination (Join-Path $dest $file.Name) -Force
    Write-Output "moved: $($file.FullName.Replace($root,''))"
}

# --- raiz: logs, dumps, relatorios soltos, pacotes, docs legados (MetalFisa PCP / MetalFisa Anty) ---
$rootPatterns = @(
 '*.log','server_*log*.txt','server_pm2_logs.txt','fat_log.txt','diff.txt','eslint_report.json','audit_report.json',
 'repomix-output.xml','client-yesterday.jsx','lynxems-producao.tar.gz','lynxems-producao.zip','sworks-agent.zip','Cargo e Funções.zip',
 'Relatorio_*.xlsx','relatorio_*.xlsx','produtos_*.xlsx','prod_*.xlsx','prod_test_export.tmp','test_output.xlsx',
 'test_pplb.bin','test_print.txt','input.txt','api_dump.json','temp_matrix.json','test_api.json','agent_pid.txt','server_pid.txt',
 'scratch_*.png','smart_plan_error.txt','matrix_debug*.log',
 'convert_docs.ps1','truncate_page.ps1','strip_bom.ps1','publish_externo.ps1','update_ui.py',
 'ATUALIZACAO_OBRIGATORIA.bat','ATUALIZAR_USUARIOS.bat','AVISO_USUARIOS.bat','CONFIGURAR_ACESSO_REDE.bat','CONFIGURAR_FIREWALL_AGENT.bat',
 'COPIAR_AGENT_PARA_REDE.bat','DESCOBRIR_CAMINHO_Q.bat','DISPONIBILIZAR_REDE.bat','NOVA_VERSAO.bat','liberar_acesso.bat',
 'EMAIL_USUARIOS.txt','EMAIL_USUARIOS_AGENT.txt','GUIA_ACESSO_USUARIOS.md','GUIA_CONEXAO_REDE.md','GUIA_INSTALACAO_AGENT.md',
 'GUIA_RAPIDO_DISPONIBILIZACAO.md','STATUS_DISPONIBILIZACAO.md','COMUNICADO_SISTEMA_DISPONIVEL.md','TESTE_SOLIDEDGE.md',
 'README_AGENTE_SOLIDEDGE.txt','VERSAO_PRODUCAO.md','EXECUTAR'
)
foreach ($p in $rootPatterns) {
    Get-ChildItem -LiteralPath $root -File -Filter $p -ErrorAction SilentlyContinue | ForEach-Object { Move-Safe $_ 'raiz' }
}

# --- server/: scripts avulsos de diagnostico/correcao pontual (somente se nao referenciados) ---
$srv = Join-Path $root 'server'
$prefixes = 'check_','fix_','hunt_','inspect_','list_','scratch_','verify_','find_','debug','explain_','dump_','mirror_','refactor_plan_','research_','investigate-','test-','test_','patch_','evolution_endpoint_fix','detailed_pcp_verify','analysis_actions','comparison_functions','update_','migrate_','setup_','payload_protheus','relatorio_tabelas_lixo','run_ref_query','run_webtech_setup','run_whatsapp_migration_ssh','force_enable_setting','restart_sinco_pm2','kill_queries'
$keep = 'test.js'
$refFiles = Get-ChildItem $srv -Recurse -File -Include *.js,*.json,*.ps1 -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules|\\uploads\\|\\scratch\\|\\tmp\\' }
$refText = @{}
foreach ($rf in $refFiles) { $refText[$rf.FullName] = [IO.File]::ReadAllText($rf.FullName) }
$allText = ($refText.Values -join "`n") + (Get-Content (Join-Path $root 'ecosystem.config.js') -Raw) + (Get-Content (Join-Path $root 'package.json') -Raw)

Get-ChildItem $srv -File | Where-Object { $_.Extension -in '.js','.py','.json','.txt','.xlsx','.pdf','.zip','.log' } | ForEach-Object {
    $n = $_.Name
    if ($n -in 'index.js','db.js','package.json','package-lock.json','.env','.env.example','ecosystem.config.js') { return }
    $isJunk = $false
    foreach ($pre in $prefixes) { if ($n.StartsWith($pre)) { $isJunk = $true } }
    if ($n -match '\.(log|txt|xlsx|pdf|zip)$' -or $n -match '^(output|server_.*|error_log|bad_output|vertical_error|smart_plan_error|mysql_test_result|protheus_log|ai_error|pcp_error|roteiro_error|meucanal_error|auth_debug|sql_debug|temp)\b') { $isJunk = $true }
    if ($n -eq 'test.js') { $isJunk = $true }
    if ($n -match '^(start-production\.bat|watchdog_state\.json)$') { $isJunk = $false }
    if (-not $isJunk) { return }
    $base = [IO.Path]::GetFileNameWithoutExtension($n)
    $refCount = 0
    foreach ($k in $refText.Keys) { if ($k -ne $_.FullName -and $refText[$k].Contains($base)) { $refCount++ } }
    if ($refCount -gt 0 -and $n -match '\.js$') { Write-Output "KEEP (referenciado): $n"; return }
    Move-Safe $_ 'server'
}

# --- server/scripts: scripts que usam bancos/credenciais fora do u494795077_SINCO ---
$legacy = 'check_metalfisa_readonly.js','check_pks.js','check_text_cols.js','check_views_and_all_refs.js','compare_metalfisa_sinco.js','copy_all_mysql_data.js','extract_missing_ddl.js','inspect_old_db.js','migrate_schema_sinco.js','test_email.js','force_send_email.js','simulate_update.js','audit_db_result.json','schema_dump.json','checkSchema.js'
foreach ($l in $legacy) {
    $f = Join-Path $srv "scripts\$l"
    if (Test-Path $f) { Move-Safe (Get-Item $f) 'server_scripts_legado' }
}
$dbg = Join-Path $srv 'scripts\debug'
if (Test-Path $dbg) {
    Get-ChildItem $dbg -File -Filter 'test_email.js' | ForEach-Object { Move-Safe $_ 'server_scripts_legado' }
    Get-ChildItem $dbg -File -Filter 'test_http.js' | ForEach-Object { Move-Safe $_ 'server_scripts_legado' }
}

# --- client: logs, builds antigos, backups ---
$cli = Join-Path $root 'client'
foreach ($p in 'build*.log','esbuild_out.txt','test_3954.pdf','test_pdf_chars*.cjs','save_pdf.js','check_routes.js') {
    Get-ChildItem $cli -File -Filter $p -ErrorAction SilentlyContinue | ForEach-Object { Move-Safe $_ 'client' }
}
$pg = Join-Path $cli 'src\pages'
foreach ($p in '*.bak','LandingPage.backup-azul.jsx') {
    Get-ChildItem $pg -File -Filter $p -ErrorAction SilentlyContinue | ForEach-Object { Move-Safe $_ 'client_src_pages' }
}
Get-ChildItem (Join-Path $cli 'src\services') -File -Filter '*_backup.js' -ErrorAction SilentlyContinue | ForEach-Object { Move-Safe $_ 'client_src_services' }
Get-ChildItem (Join-Path $srv 'routes') -File -Filter '*.bak' -ErrorAction SilentlyContinue | ForEach-Object { Move-Safe $_ 'server_routes' }
Get-ChildItem (Join-Path $srv 'routes') -File -Filter 'production_insert.txt' -ErrorAction SilentlyContinue | ForEach-Object { Move-Safe $_ 'server_routes' }

Write-Output 'DONE'
