/**
 * FASE 1 — Regressão da Sanitização (Auditoria Integral SINCO)
 * 
 * Executa todas as baterias de teste da Fase 1:
 * 1. Rotas Removidas (404 com token / 401 sem token)
 * 2. Varredura de Resquícios no Front-End
 * 3. Teste de /api/produto-protheus/* e Desacoplamento do Protheus/SolidEdge
 * 4. Verificação de Remoção do botão Prev-Bicromatização
 * 5. Auditoria de Apontamento (Saldo, Variação de Numeração, Ausência de WhatsApp)
 * 6. Auditoria de Tabelas Órfãs e SincoMetalfisa-externo
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');

require('dotenv').config({ path: path.join(SERVER_DIR, '.env') });
const jwt = require(path.join(SERVER_DIR, 'node_modules', 'jsonwebtoken'));

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const adminToken = jwt.sign(
    { idUsuario: 999, login: 'auditor_qa', IdEmpresa: 1, is_master: 1, NomeCompleto: 'Banca Auditoria QA' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

function httpRequest(method, urlPath, token = null, body = null) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body) {
            headers['Content-Type'] = 'application/json';
        }

        const req = http.request({
            hostname: '127.0.0.1',
            port: 3002,
            path: urlPath,
            method,
            headers,
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: parsed
                });
            });
        });

        req.on('error', err => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Timeout na requisição ${method} ${urlPath}`));
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('🚀 Iniciando FASE 1 — Regressão da Sanitização...');
    const resultados = {
        fase: 'FASE 1 — Regressão da sanitização',
        executadoEm: new Date().toISOString(),
        testes: []
    };

    // ── 1. Rotas Removidas ───────────────────────────────────────────────────
    console.log('\n📡 [1/6] Testando Rotas Removidas...');
    const rotasParaTestar = [
        { path: '/api/vmi', desc: 'Módulo VMI principal' },
        { path: '/api/vmi-pedidos', desc: 'Módulo VMI Pedidos' },
        { path: '/api/vmi-criticos', desc: 'Módulo VMI Críticos' },
        { path: '/api/wabtec', desc: 'Módulo WabTec principal' },
        { path: '/api/wabtec-datas', desc: 'Módulo WabTec Datas' },
        { path: '/api/engetron', desc: 'Módulo Engetron' },
        { path: '/api/reports/vmi-bicromatizacao/excel', desc: 'Relatório Excel VMI Bicromatização' }
    ];

    for (const r of rotasParaTestar) {
        // Teste com Token -> DEVE retornar 404
        try {
            const resComToken = await httpRequest('GET', r.path, adminToken);
            const ok404 = resComToken.statusCode === 404;
            console.log(`   ${ok404 ? '✅' : '❌'} ${r.path} (com token): HTTP ${resComToken.statusCode} [Esperado: 404]`);
            resultados.testes.push({
                categoria: 'Rotas Removidas',
                item: `${r.desc} (com token)`,
                endpoint: r.path,
                esperado: 404,
                obtido: resComToken.statusCode,
                status: ok404 ? 'APROVADO' : 'FALHA',
                evidencia: resComToken.data
            });
        } catch (err) {
            console.error(`   ❌ Erro ao testar ${r.path}:`, err.message);
        }

        // Teste sem Token -> 401 ou 404 (não pode ser 500 nem 200)
        try {
            const resSemToken = await httpRequest('GET', r.path, null);
            const okSemToken = (resSemToken.statusCode === 401 || resSemToken.statusCode === 404);
            console.log(`   ${okSemToken ? '✅' : '❌'} ${r.path} (sem token): HTTP ${resSemToken.statusCode} [Esperado: 401 ou 404]`);
            resultados.testes.push({
                categoria: 'Rotas Removidas',
                item: `${r.desc} (sem token)`,
                endpoint: r.path,
                esperado: '401 ou 404',
                obtido: resSemToken.statusCode,
                status: okSemToken ? 'APROVADO' : 'FALHA',
                evidencia: resSemToken.data
            });
        } catch (err) {
            console.error(`   ❌ Erro ao testar ${r.path} sem token:`, err.message);
        }
    }

    // ── 2. Varredura de Resquícios no Front-End ──────────────────────────────
    console.log('\n🔍 [2/6] Varrendo Código do Front-End por Resquícios...');
    const srcDir = path.join(CLIENT_DIR, 'src');

    function searchFiles(dir, regex) {
        const matches = [];
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const full = path.join(dir, file);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
                if (!['node_modules', 'dist'].includes(file)) {
                    matches.push(...searchFiles(full, regex));
                }
            } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
                const content = fs.readFileSync(full, 'utf8');
                const lines = content.split('\n');
                lines.forEach((l, idx) => {
                    if (regex.test(l)) {
                        matches.push({
                            file: path.relative(CLIENT_DIR, full).replace(/\\/g, '/'),
                            line: idx + 1,
                            text: l.trim()
                        });
                    }
                });
            }
        }
        return matches;
    }

    const chamadasApisRemovidas = searchFiles(srcDir, /\/api\/(vmi|wabtec|engetron)/i);
    console.log(`   Chamadas ativas para APIs removidas (/api/vmi, /api/wabtec, /api/engetron): ${chamadasApisRemovidas.length}`);
    resultados.testes.push({
        categoria: 'Varredura de Resquícios',
        item: 'Chamadas do Front-End para APIs removidas',
        esperado: 0,
        obtido: chamadasApisRemovidas.length,
        status: chamadasApisRemovidas.length === 0 ? 'APROVADO' : 'FALHA',
        evidencia: chamadasApisRemovidas
    });

    // Menções textuais que sobraram
    const mencoesTexto = searchFiles(srcDir, /\b(wabtec|engetron)\b/i);
    console.log(`   Menções de texto residuais (histórico/placeholders): ${mencoesTexto.length}`);
    resultados.testes.push({
        categoria: 'Varredura de Resquícios',
        item: 'Menções textuais residuais (Landing Page / Relatório de Entrega / Placeholders)',
        esperado: 'Mapeado para Dúvida de Regra',
        obtido: `${mencoesTexto.length} ocorrências`,
        status: 'MAPEADO_DUVIDA_REGRA',
        evidencia: mencoesTexto.map(m => `${m.file}:${m.line} -> ${m.text.substring(0, 80)}`)
    });

    // ── 3. Formulário / Engenharia / Cadastro de Produto (/api/produto-protheus/*) ─
    console.log('\n⚙️ [3/6] Testando /api/produto-protheus/consultar-desenho...');
    try {
        const resDesenhoInexistente = await httpRequest('GET', '/api/produto-protheus/consultar-desenho?desenho=QA-DESENHO-INEXISTENTE-999', adminToken);
        console.log('   Consultar desenho inexistente -> HTTP', resDesenhoInexistente.statusCode, resDesenhoInexistente.data);
        const okDesenho = resDesenhoInexistente.statusCode === 200 && resDesenhoInexistente.data?.existe === false;
        resultados.testes.push({
            categoria: 'Engenharia / Produto Protheus',
            item: 'Consulta de desenho inexistente (autônomo, sem chamar Protheus real)',
            endpoint: '/api/produto-protheus/consultar-desenho',
            esperado: { existe: false },
            obtido: resDesenhoInexistente.data,
            status: okDesenho ? 'APROVADO' : 'FALHA'
        });
    } catch (err) {
        console.error('   ❌ Erro ao testar consultar-desenho:', err.message);
    }

    // ── 4. Pedidos de Venda — Botão Prev-Bicromatização ────────────────────────
    console.log('\n🛒 [4/6] Verificando Ausência do Botão Prev-Bicromatização em Pedidos...');
    const pedidosPagePath = path.join(CLIENT_DIR, 'src', 'pages', 'erp', 'ErpPedidosPage.jsx');
    const ordersTablePath = path.join(CLIENT_DIR, 'src', 'components', 'OrdersTable.jsx');
    const contentPedidos = fs.readFileSync(pedidosPagePath, 'utf8');
    const contentOrders = fs.readFileSync(ordersTablePath, 'utf8');

    const temBicromatizacao = /Prev-Bicromatização|vmi-bicromatizacao/i.test(contentPedidos) || /Prev-Bicromatização|vmi-bicromatizacao/i.test(contentOrders);
    console.log(`   ${!temBicromatizacao ? '✅' : '❌'} Botão Prev-Bicromatização ausente em Pedidos: ${!temBicromatizacao}`);
    resultados.testes.push({
        categoria: 'Pedidos de Venda',
        item: 'Remoção do botão Prev-Bicromatização da tela de pedidos',
        esperado: 'Ausente',
        obtido: temBicromatizacao ? 'Presente' : 'Ausente',
        status: !temBicromatizacao ? 'APROVADO' : 'FALHA'
    });

    // ── 5. Apontamento de Chão de Fábrica — Saldo e Ausência de WhatsApp ───────
    console.log('\n🏭 [5/6] Auditando Regras de Apontamento e Ausência de WhatsApp...');
    const producaoPath = path.join(SERVER_DIR, 'routes', 'producao.js');
    const productionPath = path.join(SERVER_DIR, 'routes', 'production.js');
    const contentProd = fs.readFileSync(producaoPath, 'utf8');
    const contentProduction = fs.readFileSync(productionPath, 'utf8');

    const temWhatsAppApontamento = /whatsappService|evolution_api|waSend|sendWhatsApp/i.test(contentProd) || /whatsappService|evolution_api|waSend|sendWhatsApp/i.test(contentProduction);
    console.log(`   ${!temWhatsAppApontamento ? '✅' : '❌'} Disparos de WhatsApp no apontamento: ${temWhatsAppApontamento ? 'Detectado' : 'Nenhum (Removido com sucesso)'}`);
    resultados.testes.push({
        categoria: 'Apontamento de Produção',
        item: 'Ausência de disparos automáticos de WhatsApp no apontamento',
        esperado: 'Nenhum disparo',
        obtido: temWhatsAppApontamento ? 'Disparo presente' : 'Nenhum disparo',
        status: !temWhatsAppApontamento ? 'APROVADO' : 'FALHA'
    });

    const temNormalizacaoOp = /opVariants|padStart\(6,\s*'0'\)/.test(contentProduction);
    console.log(`   ${temNormalizacaoOp ? '✅' : '❌'} Normalização de variações de numeração de OP (6175 vs 006175): ${temNormalizacaoOp ? 'Ativa' : 'Ausente'}`);
    resultados.testes.push({
        categoria: 'Apontamento de Produção',
        item: 'Tratamento de variações de numeração da OP (6175 x 006175, item 1 x 01)',
        esperado: 'Ativa com opVariants',
        obtido: temNormalizacaoOp ? 'Ativa' : 'Ausente',
        status: temNormalizacaoOp ? 'APROVADO' : 'FALHA'
    });

    const temTravaSaldo = /Quantidade excede saldo/.test(contentProduction);
    console.log(`   ${temTravaSaldo ? '✅' : '❌'} Trava contra apontamento acima do saldo planejado: ${temTravaSaldo ? 'Ativa' : 'Ausente'}`);
    resultados.testes.push({
        categoria: 'Apontamento de Produção',
        item: 'Bloqueio de apontamento excedente ao saldo',
        esperado: 'Bloqueio ativo com HTTP 400',
        obtido: temTravaSaldo ? 'Bloqueio ativo' : 'Ausente',
        status: temTravaSaldo ? 'APROVADO' : 'FALHA'
    });

    // ── 6. Tabelas Órfãs e SincoMetalfisa-externo ─────────────────────────────
    console.log('\n🗄️ [6/6] Verificando Tabelas Órfãs e Configuração do SincoMetalfisa-externo...');
    const externoEnvPath = path.join(ROOT_DIR, 'SincoMetalfisa-externo', 'server', '.env');
    let externoDbInfo = 'Não encontrado';
    if (fs.existsSync(externoEnvPath)) {
        const envContent = fs.readFileSync(externoEnvPath, 'utf8');
        const hostMatch = envContent.match(/MYSQL_HOST=([^\r\n]+)/);
        const dbMatch = envContent.match(/MYSQL_DB=([^\r\n]+)/);
        externoDbInfo = `Host: ${hostMatch ? hostMatch[1] : 'N/A'} | DB: ${dbMatch ? dbMatch[1] : 'N/A'}`;
    }
    console.log('   SincoMetalfisa-externo Database Config:', externoDbInfo);
    const usaMesmoBanco = /u494795077_SINCO|193\.203\.175\.68/.test(externoDbInfo);
    console.log(`   SincoMetalfisa-externo usa o mesmo banco do SINCO? ${usaMesmoBanco ? 'SIM (Compartilhado)' : 'NÃO (Banco UOL Host independente)'}`);

    resultados.testes.push({
        categoria: 'Tabelas Órfãs e Arquitetura',
        item: 'Verificação de compartilhamento de banco com SincoMetalfisa-externo',
        esperado: 'Bancos distintos',
        obtido: externoDbInfo,
        status: !usaMesmoBanco ? 'APROVADO' : 'ALERTA_BANCO_COMPARTILHADO',
        recomendacao: 'Como SincoMetalfisa-externo aponta para metalfisa.mysql.uhserver.com (UOL Host) e o SINCO aponta para Hostinger (u494795077_SINCO), as tabelas app_*vmi* e app_wabtec_* no banco Hostinger são candidatas a DROP após backup.'
    });

    // Gravar resultado em JSON
    const outJson = path.join(__dirname, 'fase1_resultado.json');
    fs.writeFileSync(outJson, JSON.stringify(resultados, null, 2), 'utf8');
    console.log(`\n✅ Bateria de testes da FASE 1 concluída com sucesso! Resultados salvos em: ${outJson}`);
}

run().catch(err => console.error('Erro na execução da Fase 1:', err));
