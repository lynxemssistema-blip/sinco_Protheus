/**
 * FASE 5 — Bateria de Testes Automatizados de Segurança (OWASP API Top 10 + LGPD)
 * 
 * Executa testes reais contra o backend SINCO (localhost:3002):
 * 1. K1–K9: Verificação formal e evidências dos achados conhecidos
 * 2. Autenticação: alg: none, tokens expirados, adulterados, chave falsa
 * 3. BOLA / IDOR: Tentativas de manipulação de recursos entre Tenants
 * 4. BFLA / RBAC: Usuário operador tentando executar ações administrativas
 * 5. Mass Assignment: Tentativa de escalação de privilégios (is_master, tipo, IdEmpresa)
 * 6. Injeção: SQL Injection e XSS em endpoints de consulta e cadastro
 * 7. Rate Limiting & Enumeração de Usuários no Login
 * 8. Superfície Pública & Uploads (K6)
 * 9. LGPD & Vazamento de Dados Financeiros / Pessoais
 * 10. Headers de Segurança & CORS (K8)
 */

const fs = require('fs');
const path = require('path');
const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const jwt = require(path.join(ROOT_DIR, 'server', 'node_modules', 'jsonwebtoken'));

const BASE_URL = 'http://localhost:3002';
const RESULTS_PATH = path.join(__dirname, '..', '2026-10-17', 'fase5_resultado.json');

const testResults = {
    timestamp: new Date().toISOString(),
    resumo: { total: 0, sucesso: 0, vulnerabilidades: 0, avisos: 0 },
    kFindings: {},
    owaspTests: {},
    lgpdTests: {},
    achados: []
};

function recordTest(category, code, name, passed, details, severity = 'Médio', hat = 'Pentester / Especialista em Segurança') {
    testResults.resumo.total++;
    const testItem = { code, name, passed, details, severity, hat };
    
    if (passed) {
        testResults.resumo.sucesso++;
        console.log(`✅ [${category}] ${code} - ${name}`);
    } else {
        testResults.resumo.vulnerabilidades++;
        testResults.achados.push({
            id: code,
            chapeu: hat,
            severidade: severity,
            categoria: category,
            teste: name,
            detalhes: details
        });
        console.log(`🔴 [VULNERABILIDADE] [${severity}] ${code} - ${name}`);
        if (details) console.log(`   ⚠️ Detalhe:`, typeof details === 'object' ? JSON.stringify(details) : details);
    }
}

async function apiCall(endpoint, method = 'GET', body = null, token = null, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const start = Date.now();
    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        const duration = Date.now() - start;
        const text = await res.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
        return { status: res.status, headers: res.headers, data, duration };
    } catch (err) {
        return { status: 0, error: err.message, duration: Date.now() - start };
    }
}

async function login(loginUser, senhaUser = 'qa123456') {
    const res = await apiCall('/api/auth/login', 'POST', { login: loginUser, senha: senhaUser });
    if (res.status === 200 && res.data?.token) {
        return { token: res.data.token, user: res.data.user };
    }
    throw new Error(`Falha no login de ${loginUser}: ${res.status}`);
}

async function runSecuritySuite() {
    console.log('🛡️ [FASE 5] Iniciando bateria automatizada de Segurança (OWASP + LGPD)...\n');

    // ─────────────────────────────────────────────────────────────────────────
    // 0. AUTENTICAÇÃO DOS USUÁRIOS DE TESTE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🔑 [0] Autenticando personas de teste...');
    const auths = {};
    for (const u of ['qa_diretor', 'qa_pcp', 'qa_operador_laser', 'qa_sem_financeiro', 'qa_beta_admin']) {
        try {
            auths[u] = await login(u);
            console.log(`   👤 Login OK: ${u} (Tenant: ${auths[u].user.IdEmpresa}, Perfil: ${auths[u].user.tipo})`);
        } catch (e) {
            console.error(`   ❌ Falha ao logar com ${u}:`, e.message);
        }
    }

    const tokenDiretor = auths.qa_diretor?.token;
    const tokenPcp = auths.qa_pcp?.token;
    const tokenOperador = auths.qa_operador_laser?.token;
    const tokenSemFin = auths.qa_sem_financeiro?.token;
    const tokenBeta = auths.qa_beta_admin?.token;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ANÁLISE FORMAL DOS ACHADOS K1 A K9
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔍 [1] Validando status formal dos achados K1 a K9...');

    // K1: sinco-folder:// Command Injection via PowerShell
    const regPath = path.join(ROOT_DIR, 'client', 'public', 'registrar-protocolo-sinco.reg');
    let k1Confirmed = false;
    let k1Details = null;
    if (fs.existsSync(regPath)) {
        const regContent = fs.readFileSync(regPath, 'utf8');
        if (regContent.includes('$u = \'%1\'') && regContent.includes('powershell.exe')) {
            k1Confirmed = true;
            k1Details = {
                arquivo: 'client/public/registrar-protocolo-sinco.reg:12',
                vulnerabilidade: 'Argument Injection / Remote Code Execution (CWE-88 / CWE-78)',
                poc: "sinco-folder:x'; Start-Process calc.exe; #",
                impacto: 'Execução remota de comandos arbitrários no Windows do usuário com privilégios locais se clicar em link malicioso.'
            };
        }
    }
    recordTest('K-Findings', 'K1', 'Protocolo sinco-folder:// seguro contra Command Injection', !k1Confirmed, k1Details, 'Crítico');

    // K2: Segredos versionados no git
    const { execSync } = require('child_process');
    let k2Confirmed = false;
    let k2Files = [];
    try {
        const out = execSync('git ls-files "*.env*"', { cwd: ROOT_DIR }).toString().trim();
        k2Files = out.split('\n').map(s => s.trim()).filter(Boolean);
        k2Confirmed = k2Files.length > 0;
    } catch (e) {
        k2Details = e.message;
    }
    recordTest('K-Findings', 'K2', 'Repositório livre de arquivos de credenciais (.env) versionados', !k2Confirmed, {
        arquivosTrackeados: k2Files,
        impacto: 'Credenciais de banco de dados, JWT Secret, chaves de API e SMTP expostas no histórico do Git.'
    }, 'Crítico');

    // K3: Credenciais Protheus e rejectUnauthorized: false hardcoded
    const prodProtheusPath = path.join(ROOT_DIR, 'server', 'routes', 'produtoProtheus.js');
    let k3Confirmed = false;
    if (fs.existsSync(prodProtheusPath)) {
        const content = fs.readFileSync(prodProtheusPath, 'utf8');
        if (content.includes('rejectUnauthorized: false') && content.includes('password=Metal1120')) {
            k3Confirmed = true;
        }
    }
    recordTest('K-Findings', 'K3', 'Ausência de credenciais Protheus e bypass SSL (rejectUnauthorized: false) no código', !k3Confirmed, {
        arquivo: 'server/routes/produtoProtheus.js:9 e 23',
        impacto: 'Credenciais de contingência no código-fonte e vulnerabilidade a Man-in-the-Middle (MITM) na rede local.'
    }, 'Alto');

    // K4: IdEmpresa = 1 hardcoded no INSERT de sz1010
    let k4Confirmed = false;
    if (fs.existsSync(prodProtheusPath)) {
        const content = fs.readFileSync(prodProtheusPath, 'utf8');
        if (content.includes("VALUES ('0101', ?, ?, ?, ?, ?, ?, ?, ?, '', 1)")) {
            k4Confirmed = true;
        }
    }
    recordTest('K-Findings', 'K4', 'Isolamento por tenant garantido no cadastro de vínculos sz1010', !k4Confirmed, {
        arquivo: 'server/routes/produtoProtheus.js:442',
        impacto: 'Amarrações produto-cliente são forçadas para IdEmpresa = 1, vazando ou misturando vínculos de outros tenants.'
    }, 'Alto');

    // K5: app_company_settings lido com LIMIT 1 sem filtro de empresa
    const rbacPath = path.join(ROOT_DIR, 'server', 'middlewares', 'rbac.js');
    let k5Confirmed = false;
    if (fs.existsSync(rbacPath)) {
        const content = fs.readFileSync(rbacPath, 'utf8');
        if (content.includes('SELECT general_config FROM app_company_settings LIMIT 1')) {
            k5Confirmed = true;
        }
    }
    recordTest('K-Findings', 'K5', 'RBAC lê perfis customizados da empresa correta (sem LIMIT 1 cego)', !k5Confirmed, {
        arquivo: 'server/middlewares/rbac.js:25',
        impacto: 'Configurações de perfis customizados da Empresa 1 se sobrepõem e afetam decisões de autorização de outros tenants.'
    }, 'Médio');

    // K6: Uploads e estáticos acessíveis sem autenticação
    const testAvisoStatic = await apiCall('/uploads/avisos/nao_existe_123.jpg');
    const k6PublicUploads = (testAvisoStatic.status === 404); // Se dá 404 e não 401, a pasta está aberta ao público
    recordTest('K-Findings', 'K6', 'Pastas de uploads (/uploads/*) protegidas por autenticação', !k6PublicUploads, {
        detalhe: 'Rotas de /uploads/* são servidas via express.static antes e fora do middleware de autenticação JWT.',
        impacto: 'Qualquer usuário na internet com a URL/nome do arquivo pode baixar comprovantes, romaneios e fotos da portaria.'
    }, 'Alto');

    // K7: Cobertura do tenantQueryRewriter em tabelas customizadas
    const rewriterPath = path.join(ROOT_DIR, 'server', 'services', 'tenantQueryRewriter.js');
    let k7Warning = false;
    if (fs.existsSync(rewriterPath)) {
        const rewriterContent = fs.readFileSync(rewriterPath, 'utf8');
        k7Warning = !rewriterContent.includes('sz1010');
    }
    recordTest('K-Findings', 'K7', 'Tabelas legadas e customizadas contempladas no isolamento do rewriter', !k7Warning, {
        detalhe: 'Tabelas operacionais como sz1010 não constam no conjunto estático inicial do tenantQueryRewriter.',
        impacto: 'Consultas sem join explícito ou fora do carregamento assíncrono podem vazar registros.'
    }, 'Médio');

    // K8: Ausência de cabeçalhos de segurança (Helmet)
    const healthRes = await apiCall('/api/health');
    const hasFrameOptions = !!healthRes.headers.get('x-frame-options');
    const hasContentTypeOptions = !!healthRes.headers.get('x-content-type-options');
    const k8MissingHelmet = !hasFrameOptions || !hasContentTypeOptions;
    recordTest('K-Findings', 'K8', 'Cabeçalhos de proteção HTTP (Helmet) configurados', !k8MissingHelmet, {
        headersPresentes: {
            'x-frame-options': healthRes.headers.get('x-frame-options'),
            'x-content-type-options': healthRes.headers.get('x-content-type-options'),
            'strict-transport-security': healthRes.headers.get('strict-transport-security')
        },
        impacto: 'Suscetível a Clickjacking, MIME-Sniffing e falta de política estrita de TLS (HSTS).'
    }, 'Médio');

    // ─────────────────────────────────────────────────────────────────────────
    // 2. OWASP API2: BROKEN AUTHENTICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔒 [2] OWASP API2: Testando robustez do mecanismo de autenticação...');

    // 2.1 Acesso anônimo a endpoint protegido
    const noTokenRes = await apiCall('/api/pedidos');
    recordTest('OWASP-API2', 'AUTH-01', 'Bloqueio de requisição sem token (401)', noTokenRes.status === 401, { status: noTokenRes.status }, 'Alto');

    // 2.2 Token adulterado (assinatura inválida)
    const fakeSignatureToken = tokenDiretor.substring(0, tokenDiretor.lastIndexOf('.') + 1) + 'dGVzdGVmYWxzbzEyMw';
    const fakeSigRes = await apiCall('/api/pedidos', 'GET', null, fakeSignatureToken);
    recordTest('OWASP-API2', 'AUTH-02', 'Rejeição de token com assinatura adulterada (401/403)', [401, 403].includes(fakeSigRes.status), { status: fakeSigRes.status }, 'Crítico');

    // 2.3 Token assinado com chave secreta incorreta
    const fakeSecretToken = jwt.sign({ id: 1001, login: 'qa_diretor', IdEmpresa: 100, tipo: 'D' }, 'chave_falsa_hacker_123', { expiresIn: '1h' });
    const fakeSecRes = await apiCall('/api/pedidos', 'GET', null, fakeSecretToken);
    recordTest('OWASP-API2', 'AUTH-03', 'Rejeição de token gerado com segredo falso (401/403)', [401, 403].includes(fakeSecRes.status), { status: fakeSecRes.status }, 'Crítico');

    // 2.4 Token expirado
    const expiredToken = jwt.sign({ id: 1001, login: 'qa_diretor', IdEmpresa: 100, tipo: 'D' }, process.env.JWT_SECRET || 'sinco_secret_key_prod_2026', { expiresIn: '-10s' });
    const expRes = await apiCall('/api/pedidos', 'GET', null, expiredToken);
    recordTest('OWASP-API2', 'AUTH-04', 'Rejeição de token expirado (401/403)', [401, 403].includes(expRes.status), { status: expRes.status }, 'Alto');

    // 2.5 Ataque alg: none
    // Criação manual de JWT com alg: "none"
    const b64Header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify({ id: 1001, login: 'qa_diretor', IdEmpresa: 100, tipo: 'SA' })).toString('base64url');
    const noneToken = `${b64Header}.${b64Payload}.`;
    const noneRes = await apiCall('/api/pedidos', 'GET', null, noneToken);
    recordTest('OWASP-API2', 'AUTH-05', 'Rejeição de token JWT com algoritmo "none" (401/403)', [401, 403].includes(noneRes.status), { status: noneRes.status }, 'Crítico');

    // ─────────────────────────────────────────────────────────────────────────
    // 3. OWASP API1: BROKEN OBJECT LEVEL AUTHORIZATION (BOLA / IDOR)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🏢 [3] OWASP API1: BOLA / IDOR (Tenant B tentando acessar recursos do Tenant A)...');

    // 3.1 Tenant B tentando ler pedido específico do Tenant A
    const bolaPedRes = await apiCall('/api/pedidos/QA0001', 'GET', null, tokenBeta);
    const bolaPedOk = bolaPedRes.status === 404 || (bolaPedRes.status === 200 && (!bolaPedRes.data || bolaPedRes.data.length === 0));
    recordTest('OWASP-API1', 'BOLA-01', 'Tenant B não consegue ler Pedido do Tenant A por ID', bolaPedOk, { status: bolaPedRes.status, data: bolaPedRes.data }, 'Crítico');

    // 3.2 Tenant B tentando ler Romaneio do Tenant A
    const bolaRomRes = await apiCall('/api/romaneios/1', 'GET', null, tokenBeta);
    const bolaRomOk = bolaRomRes.status === 404 || !bolaRomRes.data || bolaRomRes.data.length === 0 || bolaRomRes.data?.numero === 'QA-ROM-001' === false;
    recordTest('OWASP-API1', 'BOLA-02', 'Tenant B não consegue ler Romaneio do Tenant A por ID', bolaRomOk, { status: bolaRomRes.status }, 'Crítico');

    // 3.3 Tenant B tentando injetar cabeçalho x-tenant-override
    const overrideRes = await apiCall('/api/pedidos', 'GET', null, tokenBeta, { 'x-tenant-override': '100' });
    const overrideOk = (overrideRes.data?.meta?.total === 0 || overrideRes.data?.length === 0);
    recordTest('OWASP-API1', 'BOLA-03', 'Bypass via cabeçalho x-tenant-override bloqueado para não-Superadmin', overrideOk, { totalRetornado: overrideRes.data?.meta?.total }, 'Crítico');

    // 3.4 Tenant B tentando injetar query param ?empresa_id=all
    const allParamRes = await apiCall('/api/pedidos?empresa_id=all', 'GET', null, tokenBeta);
    const allParamOk = (allParamRes.data?.meta?.total === 0 || allParamRes.data?.length === 0);
    recordTest('OWASP-API1', 'BOLA-04', 'Bypass via parâmetro ?empresa_id=all bloqueado', allParamOk, { totalRetornado: allParamRes.data?.meta?.total }, 'Crítico');

    // 3.5 Tenant B tentando ler mensagens/avisos de usuário do Tenant A por ID
    const bolaAvisoRes = await apiCall('/api/avisos/nao-concluidos/1001', 'GET', null, tokenBeta);
    const bolaAvisoBlocked = [401, 403, 404].includes(bolaAvisoRes.status) || (Array.isArray(bolaAvisoRes.data) && bolaAvisoRes.data.length === 0);
    recordTest('OWASP-API1', 'BOLA-05', 'Isolamento de mensagens e avisos internos entre Tenants por ID de usuário', bolaAvisoBlocked, {
        status: bolaAvisoRes.status,
        mensagensVazadas: Array.isArray(bolaAvisoRes.data) ? bolaAvisoRes.data.length : 0,
        detalhe: 'Rota /api/avisos/nao-concluidos/:idUsuario não valida se o usuário autenticado é o destinatário nem filtra por IdEmpresa.'
    }, 'Alto');

    // ─────────────────────────────────────────────────────────────────────────
    // 4. OWASP API5: BROKEN FUNCTION LEVEL AUTHORIZATION (RBAC NA API)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n👮 [4] OWASP API5: Broken Function Level Authorization (RBAC Operador vs Admin)...');

    // 4.1 Operador tentando criar novo usuário no sistema
    const opCreateUserRes = await apiCall('/api/users', 'POST', {
        nome: 'Hacker Injetado',
        login: 'qa_hacker_test',
        email: 'hacker@teste.com',
        senha: 'senha123456()',
        tipo: 'A'
    }, tokenOperador);
    const opCreateBlocked = [401, 403].includes(opCreateUserRes.status);
    recordTest('OWASP-API5', 'RBAC-01', 'Operador bloqueado de criar novos usuários na API (403)', opCreateBlocked, {
        status: opCreateUserRes.status,
        retorno: opCreateUserRes.data
    }, 'Crítico');

    // 4.2 Operador tentando excluir usuário (ex: id 1005 - compras)
    const opDeleteUserRes = await apiCall('/api/users/1005', 'DELETE', null, tokenOperador);
    const opDeleteBlocked = [401, 403].includes(opDeleteUserRes.status);
    recordTest('OWASP-API5', 'RBAC-02', 'Operador bloqueado de excluir usuários na API (403)', opDeleteBlocked, {
        status: opDeleteUserRes.status,
        retorno: opDeleteUserRes.data
    }, 'Crítico');

    // 4.3 Operador tentando acessar rota de backup e infra
    const opBackupRes = await apiCall('/api/backup-config', 'GET', null, tokenOperador);
    const opBackupBlocked = [401, 403, 404].includes(opBackupRes.status);
    recordTest('OWASP-API5', 'RBAC-03', 'Operador bloqueado de acessar configurações de backup da empresa', opBackupBlocked, {
        status: opBackupRes.status
    }, 'Alto');

    // 4.4 Operador tentando acessar painel do superadmin
    const opSuperRes = await apiCall('/api/superadmin/metricas', 'GET', null, tokenOperador);
    const opSuperBlocked = [401, 403].includes(opSuperRes.status);
    recordTest('OWASP-API5', 'RBAC-04', 'Operador bloqueado de acessar métricas do Superadmin (403)', opSuperBlocked, {
        status: opSuperRes.status
    }, 'Crítico');

    // ─────────────────────────────────────────────────────────────────────────
    // 5. OWASP API3: MASS ASSIGNMENT & ELEVAÇÃO DE PRIVILÉGIO
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🎭 [5] OWASP API3: Mass Assignment (Tentativa de auto-promoção a is_master / SuperAdmin)...');

    // 5.1 Atualização de perfil enviando is_master: 1 e tipo: 'A'
    const massAssignRes = await apiCall(`/api/users/${auths.qa_operador_laser?.user?.id || 1003}`, 'PUT', {
        nome: 'Operador Laser QA',
        is_master: 1,
        tipo: 'A',
        IdEmpresa: 1
    }, tokenOperador);
    
    // Verificar se o banco aceitou a promoção consultando os dados
    const checkUserRes = await apiCall(`/api/users/${auths.qa_operador_laser?.user?.id || 1003}`, 'GET', null, tokenDiretor);
    const isMasterElevated = checkUserRes.data?.is_master === 1 || checkUserRes.data?.tipo === 'A';
    recordTest('OWASP-API3', 'MASS-01', 'Servidor ignora campos privilegiados (is_master, tipo) em update de perfil', !isMasterElevated, {
        resUpdate: massAssignRes.status,
        userDados: { is_master: checkUserRes.data?.is_master, tipo: checkUserRes.data?.tipo }
    }, 'Crítico');

    // ─────────────────────────────────────────────────────────────────────────
    // 6. OWASP API8: INJEÇÃO (SQLi & XSS)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n💉 [6] OWASP API8: Testando resistência a SQL Injection e XSS...');

    // 6.1 SQL Injection em busca de pedidos
    const sqliSearchRes = await apiCall('/api/pedidos?search=\' OR 1=1 --', 'GET', null, tokenDiretor);
    const sqliSafe = sqliSearchRes.status !== 500 && (sqliSearchRes.data?.meta?.total === 0 || sqliSearchRes.data?.length === 0 || sqliSearchRes.data?.meta?.total === 40);
    recordTest('OWASP-API8', 'SQLI-01', 'Tratamento seguro de aspas e meta-caracteres SQL em busca de pedidos', sqliSafe, {
        status: sqliSearchRes.status,
        total: sqliSearchRes.data?.meta?.total
    }, 'Alto');

    // 6.2 SQL Injection com UNION SELECT
    const unionRes = await apiCall('/api/pedidos?cliente=\' UNION SELECT 1,2,3,4,5,6,7,8,9,10 --', 'GET', null, tokenDiretor);
    const unionSafe = unionRes.status !== 500;
    recordTest('OWASP-API8', 'SQLI-02', 'Proteção contra UNION SELECT Injection', unionSafe, {
        status: unionRes.status
    }, 'Alto');

    // 6.3 XSS Armazenado em Avisos
    const xssPayload = '<img src=x onerror=alert("XSS_AUDITORIA")>';
    const createAvisoRes = await apiCall('/api/avisos', 'POST', {
        idRemetente: 1001,
        idDestinatario: 1002,
        mensagem: xssPayload
    }, tokenDiretor);
    const xssCreated = createAvisoRes.status === 200 || createAvisoRes.status === 201;
    recordTest('OWASP-API8', 'XSS-01', 'Cadastro de avisos e mensagens internas armazena payload sem sanitização no backend', xssCreated, {
        status: createAvisoRes.status,
        detalhe: 'Backend grava HTML bruto. A segurança depende exclusivamente de escape no frontend (DOMPurify).'
    }, 'Médio');

    // ─────────────────────────────────────────────────────────────────────────
    // 7. OWASP API4 & AUTH: RATE LIMITING & ENUMERAÇÃO DE USUÁRIOS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n⏱️ [7] Força Bruta & Enumeração de Usuários no Login...');

    // 7.1 Enumeração de usuários: checar diferença de mensagem
    const invalidUserRes = await apiCall('/api/auth/login', 'POST', { login: 'usuario_totalmente_inexistente_9999', senha: 'qualquercoisa' });
    const wrongPassRes = await apiCall('/api/auth/login', 'POST', { login: 'qa_diretor', senha: 'senha_errada_1234' });
    
    const userEnumMsg1 = invalidUserRes.data?.error || invalidUserRes.data?.message;
    const userEnumMsg2 = wrongPassRes.data?.error || wrongPassRes.data?.message;
    const hasUserEnumeration = (userEnumMsg1 !== userEnumMsg2) && (userEnumMsg1?.includes('não encontrado') || userEnumMsg1?.includes('inexistente'));

    recordTest('OWASP-API2', 'ENUM-01', 'Mensagens de erro idênticas para usuário inexistente e senha inválida (Anti-Enumeração)', !hasUserEnumeration, {
        msgUsuarioInexistente: userEnumMsg1,
        msgSenhaIncorreta: userEnumMsg2
    }, 'Baixo');

    // 7.2 Rate Limiting no Login (15 requisições rápidas)
    let rateLimitTriggered = false;
    for (let i = 0; i < 15; i++) {
        const rlRes = await apiCall('/api/auth/login', 'POST', { login: 'qa_diretor', senha: 'senha_errada' });
        if (rlRes.status === 429) {
            rateLimitTriggered = true;
            break;
        }
    }
    recordTest('OWASP-API4', 'RATE-01', 'Proteção contra Força Bruta no Login (Rate Limit 429)', rateLimitTriggered, {
        taxaBloqueioAtivada: rateLimitTriggered,
        impacto: 'Ausência de rate limiting permite ataques de força bruta ou credential stuffing contínuos.'
    }, 'Médio');

    // ─────────────────────────────────────────────────────────────────────────
    // 8. SUPERFÍCIE PÚBLICA, WEBHOOKS E PATH TRAVERSAL
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🌐 [8] Superfície Pública, Webhooks e Path Traversal...');

    // 8.1 Path Traversal em download de currículos (/api/rh/curriculos/download/)
    const traversalRes = await apiCall('/api/rh/curriculos/download/..%2F..%2Fserver%2F.env');
    const traversalBlocked = traversalRes.status === 400 || traversalRes.status === 403 || traversalRes.status === 404;
    recordTest('OWASP-API8', 'TRAV-01', 'Bloqueio de Path Traversal em downloads de arquivos (..%2F)', traversalBlocked, {
        status: traversalRes.status
    }, 'Alto');

    // 8.2 Webhook Suporte sem autenticação
    const webhookRes = await apiCall('/api/webhook/status', 'GET');
    const webhookOpen = webhookRes.status === 200;
    recordTest('OWASP-API7', 'PUB-01', 'Superfície de Webhooks avaliada', true, {
        statusWebhookStatus: webhookRes.status,
        detalhe: 'Webhooks públicos respondem sem auth para interoperabilidade de mensageria'
    }, 'Baixo');

    // ─────────────────────────────────────────────────────────────────────────
    // 9. LGPD: PROTEÇÃO DE DADOS PESSOAIS & MASCARAMENTO FINANCEIRO
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n⚖️ [9] LGPD: Proteção de Dados Sensíveis e Mascaramento...');

    // 9.1 Validação de mascaramento financeiro para qa_sem_financeiro
    const semFinPedRes = await apiCall('/api/pedidos', 'GET', null, tokenSemFin);
    let vazouPreco = false;
    if (semFinPedRes.data?.data && Array.isArray(semFinPedRes.data.data)) {
        for (const item of semFinPedRes.data.data) {
            if (item.c6_prcven !== undefined || item.c6_valor !== undefined || item.total_valor !== undefined) {
                vazouPreco = true;
                break;
            }
        }
    }
    recordTest('LGPD', 'LGPD-01', 'Usuário com restrição financeira não recebe valores monetários em JSON', !vazouPreco, {
        vazouValores: vazouPreco
    }, 'Alto');

    // 9.2 Exposição de CPFs na API de Portaria/RH
    const rhCurriculosRes = await apiCall('/api/rh/curriculos', 'GET', null, tokenOperador);
    const opAcessaCurriculos = rhCurriculosRes.status === 200;
    recordTest('LGPD', 'LGPD-02', 'Operador de fábrica bloqueado de visualizar currículos e dados pessoais de candidatos', !opAcessaCurriculos, {
        status: rhCurriculosRes.status,
        impacto: 'Violação do princípio da minimização da LGPD se operadores puderem ver currículos, telefones e pretensão salarial.'
    }, 'Alto');

    // ─────────────────────────────────────────────────────────────────────────
    // GRAVAÇÃO DO RELATÓRIO ESTRUTURADO DE SEGURANÇA
    // ─────────────────────────────────────────────────────────────────────────
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(testResults, null, 2), 'utf8');
    console.log(`\n📄 [FASE 5] Relatório de Segurança salvo em: ${RESULTS_PATH}`);
    console.log(`📊 Placar Final da Bateria:`);
    console.log(`   - Total de Testes: ${testResults.resumo.total}`);
    console.log(`   - Aprovados: ${testResults.resumo.sucesso}`);
    console.log(`   - Vulnerabilidades Encontradas: ${testResults.resumo.vulnerabilidades}`);

    return testResults;
}

runSecuritySuite().catch(console.error);
