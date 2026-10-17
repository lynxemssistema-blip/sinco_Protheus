/**
 * FASE 0 - Reconhecimento e Inventário Completo (SINCO PROTHEUS)
 * 
 * Cruza:
 * 1. Rotas do React (App.jsx)
 * 2. Itens do Menu (menuItems.js)
 * 3. Endpoints do Express (server/index.js + server/routes/*.js)
 * 4. Chamadas de API no Front-End (client/src) e Agentes/Webhooks
 * 5. Classificação por tipo e presença de RBAC (requirePermission)
 * 6. Análise estática de SQL (segurança contra injeção e isolamento multi-tenant)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const SERVER_DIR = path.join(ROOT_DIR, 'server');
const OUT_DIR = path.resolve(__dirname);

// Base de tabelas do tenantQueryRewriter
const BASE_TENANT_TABLES = new Set([
    'sc5010', 'sc6010', 'sc2010', 'sb1010', 'sb2010', 'sa1010', 'sa2010',
    'sg2010', 'sg1010', 'sd1010', 'sd2010', 'sf1010', 'sf2010', 'sc7010',
    'sc1010', 'sh1010', 'se1010', 'se2010', 'sed010', 'ct1010', 'ct2010',
    'pcp_setores', 'pcp_setor_recursos', 'pcp_setor_responsaveis', 'pcp_recursos',
    'app_romaneios', 'app_romaneio_items', 'app_romaneios_nfs', 'app_romaneio_types',
    'app_production_appointments', 'app_production_planning', 'app_production_planning_diario',
    'app_pcp_releases', 'app_pcp_snapshots', 'app_pcp_lotes', 'app_pcp_lote_itens',
    'app_op_priorities', 'app_pedidos_inativos', 'app_pedido_itens_classificacao',
    'app_engineering_releases', 'app_engineering_bom_items', 'app_engineering_timesheets',
    'app_sgq_rncs', 'app_sgq_processos', 'app_sgq_nao_conformidades', 'app_sgq_cargos_funcoes',
    'app_solicitacoes_almoxarifado', 'app_lotes_corte', 'app_lotes_corte_itens',
    'app_produto_ata', 'app_produto_imagens', 'app_produto_estados',
    'app_faturamento_solicitacoes', 'app_faturamento_solicitacao_itens',
    'app_faturamento_auditoria', 'faturamento_pre_etiquetas', 'produtocomercial',
    'cipa_gestoes', 'cipa_cronograma_prazos', 'cipa_candidatos', 'cipa_eleitores_votaram', 'cipa_cedulas_votos', 'cipa_reunioes_atas',
    'portaria_turnos', 'portaria_porteiros', 'portaria_acessos', 'portaria_ocorrencias',
    'app_user_preferences', 'user_preferences',
    'sst_brigada_config', 'sst_brigada_membros', 'sst_brigada_treinamentos', 'sst_brigada_equipamentos', 'sst_brigada_inspecoes', 'sst_brigada_simulados'
]);

// 1. Extrair Itens de Menu (menuItems.js)
function extrairMenuItems() {
    const menuPath = path.join(CLIENT_DIR, 'src', 'config', 'menuItems.js');
    if (!fs.existsSync(menuPath)) return [];
    const content = fs.readFileSync(menuPath, 'utf8');
    
    const items = [];
    // Encontrar blocos com id, label, path
    const regex = /{\s*id:\s*['"]([^'"]+)['"],\s*label:\s*['"]([^'"]+)['"],\s*path:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        items.push({
            id: match[1],
            label: match[2],
            path: match[3]
        });
    }
    return items;
}

// 2. Extrair Rotas do React (App.jsx)
function extrairRotasReact() {
    const appPath = path.join(CLIENT_DIR, 'src', 'App.jsx');
    if (!fs.existsSync(appPath)) return [];
    const content = fs.readFileSync(appPath, 'utf8');

    const routes = [];
    const regex = /<Route\s+path=["']([^"']+)["']\s+element=\{([\s\S]*?)\}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const routePath = match[1];
        const elementCode = match[2];
        // Encontrar nome do componente
        const compMatch = elementCode.match(/<([A-Z][A-Za-z0-9_]+)/);
        routes.push({
            path: routePath,
            component: compMatch ? compMatch[1] : 'Unknown'
        });
    }
    return routes;
}

// 3. Extrair Routers montados em server/index.js
function extrairRoutersIndex() {
    const indexPath = path.join(SERVER_DIR, 'index.js');
    const content = fs.readFileSync(indexPath, 'utf8');

    // Mapear variavel de require -> arquivo
    const requireMap = {};
    const reqRegex = /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*require\(['"]\.\/routes\/([^'"]+)['"]\)/g;
    let match;
    while ((match = reqRegex.exec(content)) !== null) {
        requireMap[match[1]] = match[2].endsWith('.js') ? match[2] : `${match[2]}.js`;
    }

    // Mapear app.use('/api/...', varName)
    const mounted = [];
    const useRegex = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
    while ((match = useRegex.exec(content)) !== null) {
        const basePath = match[1];
        const varName = match[2];
        const file = requireMap[varName] || `${varName}.js`;
        mounted.push({
            basePath,
            varName,
            file
        });
    }

    // Também capturar inline app.use('/api/...', require('./routes/...'))
    const inlineRegex = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*require\(['"]\.\/routes\/([^'"]+)['"]\)\s*\)/g;
    while ((match = inlineRegex.exec(content)) !== null) {
        const basePath = match[1];
        const routeRel = match[2].endsWith('.js') ? match[2] : `${match[2]}.js`;
        mounted.push({
            basePath,
            varName: path.basename(routeRel, '.js'),
            file: routeRel
        });
    }

    return mounted;
}

// 4. Analisar Endpoints e SQL dentro de server/routes/*.js
function analisarRouteFiles(mountedRouters) {
    const routesDir = path.join(SERVER_DIR, 'routes');
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    const endpoints = [];
    const sqlVulnerabilities = [];

    // Mapear prefixos por arquivo
    const prefixMap = {};
    for (const m of mountedRouters) {
        if (!prefixMap[m.file]) prefixMap[m.file] = [];
        prefixMap[m.file].push(m.basePath);
    }

    for (const file of routeFiles) {
        const filePath = path.join(routesDir, file);
        const code = fs.readFileSync(filePath, 'utf8');
        const lines = code.split('\n');

        const basePaths = prefixMap[file] || ['/api/' + path.basename(file, '.js')];

        // Procurar definições de router.(get|post|put|delete|patch)
        const epRegex = /router\.(get|post|put|delete|patch)\(\s*['"]([^'"]*)['"]([\s\S]*?)(?=\n\s*router\.|\nmodule\.exports|$)/g;
        let match;
        while ((match = epRegex.exec(code)) !== null) {
            const method = match[1].toUpperCase();
            const subPath = match[2];
            const handlerBlock = match[3];

            // Determinar linha aproximada
            const upToMatch = code.substring(0, match.index);
            const lineNum = upToMatch.split('\n').length;

            const hasRequirePermission = /requirePermission\(/.test(handlerBlock);
            const hasAuthToken = /authenticateToken/.test(handlerBlock);

            // Classificar tipo de endpoint
            let tipo = 'leitura';
            if (method !== 'GET') tipo = 'escrita';
            if (/excel|pdf|relatorio|export|download/i.test(subPath) || /excel|pdf|xlsx/i.test(handlerBlock)) {
                tipo = 'exportação';
            }
            if (/upload|multer/i.test(handlerBlock) || /upload/i.test(subPath)) {
                tipo = 'upload';
            }
            if (/gemini|genai|ia|ai|prompt|hermes/i.test(file) || /ai|gemini|hermes/i.test(subPath)) {
                tipo = 'IA';
            }
            if (/protheus|firebird|evolution|whatsapp|mail|argox/i.test(file) || /protheus|firebird/i.test(subPath)) {
                tipo = 'integração externa';
            }

            for (const bPath of basePaths) {
                const cleanSub = subPath === '/' ? '' : (subPath.startsWith('/') ? subPath : `/${subPath}`);
                const fullPath = `${bPath}${cleanSub}`.replace(/\/+/g, '/');

                endpoints.push({
                    method,
                    basePath: bPath,
                    subPath,
                    fullPath,
                    file,
                    line: lineNum,
                    tipo,
                    hasRequirePermission,
                    hasAuthToken
                });
            }

            // Análise SQL no bloco
            analisarSqlBlock(handlerBlock, file, lineNum, sqlVulnerabilities);
        }
    }

    return { endpoints, sqlVulnerabilities };
}

// Analisar bloco de código para vulnerabilidades SQL
function analisarSqlBlock(code, file, startLine, sqlList) {
    // 1. Procurar template strings ou concatenação com queries SQL
    const queryCalls = [
        /(?:db|pool|connection)\.query\(\s*`([^`]+)`/g,
        /(?:db|pool|connection)\.query\(\s*(['"][^'"]+['"]\s*\+[\s\S]*?)(?=,\s*\[|\))/g
    ];

    // Detecção de injeção direta via template literal ${...}
    let m;
    const templateRegex = /(?:db|pool|connection)\.query\(\s*`([\s\S]*?)`/g;
    while ((m = templateRegex.exec(code)) !== null) {
        const sqlText = m[1];
        if (/\$\{[^}]+\}/.test(sqlText)) {
            // Há interpolação direta! Verificar se não é apenas nome de tabela estática
            const interpolations = sqlText.match(/\$\{[^}]+\}/g) || [];
            sqlList.push({
                file,
                line: startLine,
                tipo: 'INJECAO_TEMPLATE_STRING',
                snippet: sqlText.substring(0, 150).replace(/\s+/g, ' '),
                variaveis: interpolations
            });
        }

        // Checar ausência de filtro IdEmpresa
        checarFiltroEmpresa(sqlText, file, startLine, sqlList);
    }
}

function checarFiltroEmpresa(sqlText, file, line, sqlList) {
    const cleanSql = sqlText.toLowerCase().replace(/\s+/g, ' ');
    // Extrair tabelas após FROM ou JOIN
    const fromMatches = cleanSql.match(/(?:from|join)\s+([a-z0-9_]+)/g);
    if (!fromMatches) return;

    for (const fm of fromMatches) {
        const tbl = fm.replace(/^(from|join)\s+/, '').trim();
        // Se a tabela NÃO está na lista do tenantQueryRewriter e não é tabela do sistema
        if (!BASE_TENANT_TABLES.has(tbl) && !['empresa', 'usuario', 'information_schema'].includes(tbl)) {
            // Verificar se na query há menção a idempresa ou empresa
            if (!/idempresa|empresa_id|tenantid/.test(cleanSql)) {
                sqlList.push({
                    file,
                    line,
                    tipo: 'SEM_ISOLAMENTO_EMPRESA',
                    tabela: tbl,
                    snippet: sqlText.substring(0, 150).replace(/\s+/g, ' ')
                });
            }
        }
    }
}

// 5. Mapear chamadas de API no Frontend (client/src)
function extrairChamadasFront(clientDir) {
    const chamadas = [];

    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (!['node_modules', 'dist', '.git'].includes(file)) {
                    walkDir(fullPath);
                }
            } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
                scanFileForApi(fullPath, chamadas);
            }
        }
    }

    function scanFileForApi(filePath, list) {
        const code = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(CLIENT_DIR, filePath).replace(/\\/g, '/');

        // Regex para api.(get|post|put|delete|patch)('...') ou axios ou fetch
        const apiRegex = /(?:api|axios|instance)\.(get|post|put|delete|patch)\(\s*[`'"]([^`'"]+)[`'"]/g;
        let m;
        while ((m = apiRegex.exec(code)) !== null) {
            list.push({
                callerFile: relPath,
                method: m[1].toUpperCase(),
                urlPattern: m[2]
            });
        }

        const fetchRegex = /fetch\(\s*[`'"]([^`'"]+)[`'"]/g;
        while ((m = fetchRegex.exec(code)) !== null) {
            if (m[1].startsWith('/api')) {
                list.push({
                    callerFile: relPath,
                    method: 'FETCH',
                    urlPattern: m[1]
                });
            }
        }
    }

    walkDir(path.join(clientDir, 'src'));
    return chamadas;
}

// 6. Mapear Agentes externos (solidedge-agent, sworks-agent, print-agent)
function extrairChamadasAgentes() {
    const chamadasAgentes = [];
    const agentPaths = [
        path.join(ROOT_DIR, 'solidedge-agent'),
        path.join(ROOT_DIR, 'sworks-agent'),
        path.join(ROOT_DIR, 'print-agent.js')
    ];

    for (const ap of agentPaths) {
        if (!fs.existsSync(ap)) continue;
        const stat = fs.statSync(ap);
        if (stat.isDirectory()) {
            const files = fs.readdirSync(ap).filter(f => f.endsWith('.js') || f.endsWith('.py') || f.endsWith('.cs'));
            for (const f of files) {
                const content = fs.readFileSync(path.join(ap, f), 'utf8');
                const relPath = path.relative(ROOT_DIR, path.join(ap, f)).replace(/\\/g, '/');
                extrairUrlsDeTexto(content, relPath, chamadasAgentes);
            }
        } else {
            const content = fs.readFileSync(ap, 'utf8');
            const relPath = path.relative(ROOT_DIR, ap).replace(/\\/g, '/');
            extrairUrlsDeTexto(content, relPath, chamadasAgentes);
        }
    }
    return chamadasAgentes;
}

function extrairUrlsDeTexto(text, relFile, list) {
    const regex = /['"`](\/api\/[^'"`\s\?]+)['"`]/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
        list.push({
            callerFile: relFile,
            method: 'ANY',
            urlPattern: m[1]
        });
    }
}

// EXECUÇÃO PRINCIPAL
function run() {
    console.log('🚀 Iniciando FASE 0 — Reconhecimento e Inventário Completo...');

    // 1. Menu Items
    const menuItems = extrairMenuItems();
    console.log(`📋 Total de Itens de Menu encontrados: ${menuItems.length}`);

    // 2. Rotas React
    const reactRoutes = extrairRotasReact();
    console.log(`🌐 Total de Rotas React encontradas: ${reactRoutes.length}`);

    // 3. Routers Montados em server/index.js
    const mountedRouters = extrairRoutersIndex();
    console.log(`🔌 Total de Routers montados em server/index.js: ${mountedRouters.length}`);

    // 4. Endpoints e Análise de SQL
    const { endpoints, sqlVulnerabilities } = analisarRouteFiles(mountedRouters);
    console.log(`📡 Total de Endpoints da API mapeados: ${endpoints.length}`);
    console.log(`⚠️ Alertas de SQL Estático: ${sqlVulnerabilities.length}`);

    // 5. Chamadas do Front-End
    const frontCalls = extrairChamadasFront(CLIENT_DIR);
    console.log(`💻 Total de Chamadas de API mapeadas no Front: ${frontCalls.length}`);

    // 6. Chamadas de Agentes
    const agentCalls = extrairChamadasAgentes();
    console.log(`🤖 Total de Chamadas de Agentes Externos: ${agentCalls.length}`);

    // 7. Cruzamento e Detecção de Órfãs
    // A. Item de Menu sem rota React
    const menuPaths = new Set(menuItems.map(m => m.path));
    const reactPaths = new Set(reactRoutes.map(r => r.path));

    const menuSemRota = menuItems.filter(m => !reactPaths.has(m.path));
    const rotaSemMenu = reactRoutes.filter(r => !menuPaths.has(r.path));

    // B. Endpoints não chamados por nenhuma tela
    // Normalizar padrão de url para comparação
    function matchesEndpoint(callUrl, epPath) {
        let cleanCall = callUrl.split('?')[0].replace(/\/+$/, '');
        let cleanEp = epPath.replace(/\/+$/, '');
        
        // Substituir :param por regex
        const regexStr = '^' + cleanEp.replace(/:[a-zA-Z0-9_]+/g, '[^/]+') + '$';
        try {
            return new RegExp(regexStr).test(cleanCall);
        } catch (_) {
            return cleanCall === cleanEp;
        }
    }

    const allFrontUrls = frontCalls.map(c => c.urlPattern);
    const allAgentUrls = agentCalls.map(c => c.urlPattern);

    const endpointsSemFront = [];
    for (const ep of endpoints) {
        const usedByFront = allFrontUrls.some(u => matchesEndpoint(u, ep.fullPath) || u.startsWith(ep.basePath));
        const usedByAgent = allAgentUrls.some(u => matchesEndpoint(u, ep.fullPath) || u.startsWith(ep.basePath));
        if (!usedByFront) {
            endpointsSemFront.push({
                ...ep,
                usadoPorAgente: usedByAgent
            });
        }
    }

    // C. Chamadas do Front para endpoints inexistentes
    const chamadasFrontInexistentes = [];
    for (const fc of frontCalls) {
        const cleanUrl = fc.urlPattern.split('?')[0];
        if (!cleanUrl.startsWith('/api')) continue; // ignora chamadas relativas estranhas
        const exists = endpoints.some(ep => matchesEndpoint(cleanUrl, ep.fullPath) || cleanUrl.startsWith(ep.basePath));
        if (!exists) {
            chamadasFrontInexistentes.push(fc);
        }
    }

    // Classificação por Tipo
    const contagemPorTipo = {};
    let semRbacCount = 0;
    for (const ep of endpoints) {
        contagemPorTipo[ep.tipo] = (contagemPorTipo[ep.tipo] || 0) + 1;
        if (!ep.hasRequirePermission) semRbacCount++;
    }

    const resultadoInventario = {
        geradoEm: new Date().toISOString(),
        estatisticas: {
            totalRoutersMontados: mountedRouters.length,
            linhaDeBaseEsperada: 81,
            diferencaLinhaDeBase: mountedRouters.length - 81,
            totalEndpoints: endpoints.length,
            classificacaoEndpoints: contagemPorTipo,
            endpointsSemRequirePermission: semRbacCount,
            totalRotasReact: reactRoutes.length,
            totalItensMenu: menuItems.length,
            menuSemRotaCount: menuSemRota.length,
            rotaSemMenuCount: rotaSemMenu.length,
            endpointsSemFrontCount: endpointsSemFront.length,
            chamadasFrontInexistentesCount: chamadasFrontInexistentes.length,
            alertasSqlCount: sqlVulnerabilities.length
        },
        orfas: {
            menuSemRota,
            rotaSemMenu: rotaSemMenu.map(r => ({ path: r.path, component: r.component })),
            chamadasFrontInexistentes,
            endpointsSemFront: endpointsSemFront.map(e => ({
                method: e.method,
                fullPath: e.fullPath,
                file: e.file,
                line: e.line,
                usadoPorAgente: e.usadoPorAgente
            }))
        },
        routersMontados: mountedRouters,
        endpoints,
        alertasSql: sqlVulnerabilities
    };

    const outJsonPath = path.join(OUT_DIR, 'inventario.json');
    fs.writeFileSync(outJsonPath, JSON.stringify(resultadoInventario, null, 2), 'utf8');
    console.log(`✅ Inventário salvo com sucesso em: ${outJsonPath}`);

    // Imprimir Relatório Resumido no console
    console.log('\n======================================================');
    console.log('📊 RESUMO EXECUTIVO — FASE 0 (INVENTÁRIO DO SISTEMA)');
    console.log('======================================================');
    console.log(`• Routers Montados em server/index.js: ${mountedRouters.length} (Linha de base: 81)`);
    console.log(`• Total de Endpoints da API: ${endpoints.length}`);
    console.log(`  - Leitura: ${contagemPorTipo['leitura'] || 0}`);
    console.log(`  - Escrita: ${contagemPorTipo['escrita'] || 0}`);
    console.log(`  - Exportação: ${contagemPorTipo['exportação'] || 0}`);
    console.log(`  - Upload: ${contagemPorTipo['upload'] || 0}`);
    console.log(`  - IA: ${contagemPorTipo['IA'] || 0}`);
    console.log(`  - Integração Externa: ${contagemPorTipo['integração externa'] || 0}`);
    console.log(`• Endpoints sem requirePermission: ${semRbacCount}`);
    console.log(`• Rotas React: ${reactRoutes.length} | Itens de Menu: ${menuItems.length}`);
    console.log(`• Itens de Menu sem Rota React: ${menuSemRota.length}`);
    console.log(`• Rotas React sem Item de Menu (sub-telas / detalhes): ${rotaSemMenu.length}`);
    console.log(`• Chamadas do Front para rotas potencialmente inexistentes: ${chamadasFrontInexistentes.length}`);
    console.log(`• Alertas Estáticos de SQL (Injeção / Sem Tenant): ${sqlVulnerabilities.length}`);
    console.log('======================================================\n');
}

run();
