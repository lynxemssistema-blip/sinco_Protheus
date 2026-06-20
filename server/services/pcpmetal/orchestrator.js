/**
 * PCPMetal - Orchestrator
 * Accepts an optional `emit(step)` callback to stream reasoning steps in real-time.
 */
const { askGemini, parseSQLFromResponse } = require('./geminiClient');
const { runQuery, getOrderContext } = require('./queryRunner');
const { loadSchemaContext, buildSystemPrompt } = require('./contextBuilder');
const mysqlPool = require('../mysqlService');

const MAX_SQL_ROUNDS = 4;

async function loadAgent(papel) {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT * FROM pcpmetal_agentes WHERE papel = ? AND ativo = 1 ORDER BY id ASC LIMIT 1',
            [papel]
        );
        return rows[0] || null;
    } catch (err) {
        console.error(`[Orchestrator] Failed to load agent "${papel}":`, err.message);
        return null;
    }
}

async function loadAllActiveAgents() {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT * FROM pcpmetal_agentes WHERE ativo = 1 ORDER BY id ASC'
        );
        return rows;
    } catch (err) {
        return [];
    }
}

/**
 * Main orchestration function
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Object} params.requestContext - { pedido, item, cliente, produto }
 * @param {Object} [params.pageData]     - Dados ja carregados na pagina (ops, filtros, etc.)
 * @param {number} params.userId
 * @param {Function} [params.emit] - optional SSE callback: emit({ type, message, data? })
 */
async function orchestrate({ userMessage, requestContext = {}, pageData = null, userId, historico = [], emit }) {
    const send = emit || (() => { });
    const executedSQLs = [];

    // Build conversation history suffix for prompt context (last 6 turns)
    const MAX_HIST = 6;
    const recentHistory = historico.slice(-MAX_HIST);
    const historyContext = recentHistory.length > 0
        ? '\n\n---\n## HISTÓRICO DESTA CONVERSA (use como contexto):\n' +
        recentHistory.map(h => `**${h.role === 'user' ? 'Usuário' : 'PCPMetal'}:** ${h.text}`).join('\n\n')
        : '';

    // Detectar se o usuário quer explicitamente uma consulta ao banco de dados
    const DB_KEYWORDS = [
        'banco', 'banco de dados', 'consultar', 'consulta', 'sql', 'buscar no banco',
        'historico de apontamentos', 'histórico de apontamentos', 'apontamentos reais',
        'planejamento salvo', 'datas salvas', 'atualizar planejamento', 'alterar planejamento',
        'salvar data', 'registrar', 'gravar'
    ];
    const perguntaLower = userMessage.toLowerCase();
    const needsDB = DB_KEYWORDS.some(kw => perguntaLower.includes(kw));

    send({ type: 'step', icon: '🗂️', message: needsDB
        ? 'Consulta ao banco de dados solicitada — ativando Analista SQL...'
        : 'Analisando dados da página de Controle de Produção...' });

    const schemaRows = needsDB ? await loadSchemaContext() : [];

    let orderContext = null;
    if (needsDB && requestContext.pedido) {
        send({ type: 'step', icon: '📦', message: `Buscando dados do pedido ${requestContext.pedido.trim()} no banco...` });
        orderContext = await getOrderContext(requestContext.pedido, requestContext.item);
        if (orderContext) {
            const itemCount = orderContext.itens?.length || 0;
            send({ type: 'step', icon: '✅', message: `Pedido encontrado — ${itemCount} item(s) carregado(s)` });
        }
    }

    // ---- STEP 2: SQL Analyst Phase (somente quando DB explicitamente solicitado) ----
    const queryResults = [];

    if (needsDB) {
        send({ type: 'step', icon: '🤖', message: 'Analista SQL analisando a pergunta e gerando consultas...' });

        const analystAgent = await loadAgent('analista_sql');
        if (!analystAgent) {
            send({ type: 'error', message: 'Agente Analista não configurado.' });
            return {
                answer: '❌ Agente Analista SQL não configurado. Vá em Configurações > Inteligência Artificial.',
                sqlsExecuted: [],
                error: 'analyst_not_configured'
            };
        }

        send({ type: 'step', icon: '💬', message: `Consultando modelo **${analystAgent.modelo || 'gemini-2.5-flash'}**...` });
        const analystPrompt = buildSystemPrompt(analystAgent, { ...requestContext, orderContext }, schemaRows);
        const analystQuestion = `Pergunta do usuário: "${userMessage}"${historyContext}\n\nGenere as consultas SQL necessárias. Se o usuário pedir para alterar/atualizar algo, você pode gerar comandos UPDATE, INSERT ou DELETE apenas no MySQL. Execute no máximo ${MAX_SQL_ROUNDS} consultas. Formato: \`\`\`sql\n[BANCO: postgresql ou mysql]\nSELECT ou UPDATE...\n\`\`\``;

        const analystResponse = await askGemini(analystPrompt, analystQuestion, analystAgent.modelo);

        // ---- STEP 3: Execute generated SQL queries ----
        const sqlQueries = parseSQLFromResponse(analystResponse);

        if (sqlQueries.length === 0) {
            send({ type: 'step', icon: '⚠️', message: 'Nenhuma consulta SQL gerada — respondendo com contexto base.' });
        } else {
            send({ type: 'step', icon: '🔍', message: `${sqlQueries.length} consulta(s) SQL gerada(s) — executando...` });
        }

        for (let i = 0; i < sqlQueries.slice(0, MAX_SQL_ROUNDS).length; i++) {
            const { banco, sql } = sqlQueries[i];
            const dbLabel = banco === 'postgresql' ? 'Protheus (PostgreSQL)' : 'App MetalFisa (MySQL)';
            send({
                type: 'sql',
                icon: '⚙️',
                message: `Executando consulta ${i + 1}/${sqlQueries.length} em **${dbLabel}**`,
                data: { banco, sql }
            });
            try {
                const isDml = /^(UPDATE|INSERT|DELETE)\s/i.test(sql.trim());
                const permissionGranted = /(autorizado|pode fazer|pode executar|aprovo|sim|atualize|execute|confirmo)/i.test(userMessage);

                if (isDml && !permissionGranted) {
                    const msg = 'SQL de alteração gerado, aguardando permissão do usuário. Peça permissão antes de executar.';
                    queryResults.push({ banco, sql, rows: [{ aviso: msg }], rowCount: 0, error: null });
                    executedSQLs.push({ banco, sql, aviso: msg });
                    send({ type: 'step', icon: '⚠️', message: `Consulta ${i + 1} (DML) requer autorização para executar.` });
                } else if (isDml && banco === 'postgresql') {
                    const msg = 'Não é permitido executar alterações no Protheus (PostgreSQL).';
                    queryResults.push({ banco, sql, rows: [{ erro: msg }], rowCount: 0, error: msg });
                    executedSQLs.push({ banco, sql, error: msg });
                    send({ type: 'step', icon: '❌', message: `Consulta ${i + 1} bloqueada: ${msg}` });
                } else {
                    const result = await runQuery(banco, sql);
                    queryResults.push({ banco, sql, rows: result.rows, rowCount: result.rowCount, error: null });
                    executedSQLs.push({ banco, sql, rowCount: result.rowCount });
                    send({ type: 'step', icon: '✅', message: `Consulta ${i + 1} retornou **${result.rowCount}** linha(s)` });
                }
            } catch (err) {
                queryResults.push({ banco, sql, rows: [], rowCount: 0, error: err.message });
                executedSQLs.push({ banco, sql, error: err.message });
                send({ type: 'step', icon: '❌', message: `Consulta ${i + 1} falhou: ${err.message}` });
            }
        }
    }

    // ---- STEP 4: Strategist Phase ----
    send({ type: 'step', icon: '🧠', message: needsDB
        ? 'Estrategista PCPMetal analisando os dados coletados do banco...'
        : 'Estrategista PCPMetal analisando dados da página de Controle de Produção...' });

    const strategistAgent = await loadAgent('estrategista');
    if (!strategistAgent) {
        send({ type: 'error', message: 'Agente Estrategista não configurado.' });
        return {
            answer: '❌ Agente Estrategista não configurado.',
            sqlsExecuted: executedSQLs,
            error: 'strategist_not_configured'
        };
    }

    const strategistPrompt = buildSystemPrompt(strategistAgent, { ...requestContext, orderContext }, schemaRows);

    // Monta bloco de dados: prioriza pageData, depois resultados de SQL
    let dataBlock = '';
    
    // Inject page-specific instructions
    if (requestContext.page === 'visao-geral') {
        dataBlock += `\n[INSTRUÇÃO IMPORTANTE - VISÃO GERAL]: A data de hoje deve ser considerada sempre como a "Data de Corte". Isso significa que TODOS os pedidos, OPs ou itens que NÃO ESTÃO CONCLUÍDOS e possuem datas anteriores a hoje devem gerar ALERTAS CLAROS (estão atrasados). Destaque isso proativamente, especialmente se o usuário for do setor de PCP.\n`;
    }

    if (pageData && (pageData.ops?.length || pageData.selectedOps?.length)) {
        const opsParaAnalise = pageData.selectedOps?.length > 0 ? pageData.selectedOps : pageData.ops;
        const preview = JSON.stringify((opsParaAnalise || []).slice(0, 100), null, 2);
        dataBlock += `### DADOS DA PÁGINA "CONTROLE DE PRODUÇÃO" (fonte primária):\n`;
        dataBlock += `Total de OPs visíveis: ${pageData.ops?.length || 0} | OPs selecionadas: ${pageData.selectedOps?.length || 0}\n`;
        if (pageData.filters) dataBlock += `Filtros ativos: ${JSON.stringify(pageData.filters)}\n`;
        dataBlock += `\nAmostra das OPs (até 100):\n\`\`\`json\n${preview}\n\`\`\`\n`;
    }
    if (queryResults.length > 0) {
        dataBlock += queryResults.map((qr, idx) => {
            const rows = qr.rows || [];
            const preview = JSON.stringify(rows.slice(0, 50), null, 2);
            return `### Resultado SQL ${idx + 1} (${qr.banco}):\nSQL: \`${qr.sql}\`\n${qr.error ? `ERRO: ${qr.error}` : `${qr.rowCount} linha(s):\n\`\`\`json\n${preview}\n\`\`\``}`;
        }).join('\n\n');
    }
    if (!dataBlock) dataBlock = 'Nenhum dado disponível.';

    const finalQuestion = `Pergunta original: "${userMessage}"${historyContext}\n\n${dataBlock}\n\nResponda diretamente à pergunta do usuário em Português (Brasil). IMPORTANTE: (1) O seu estilo de conversa deve ser como num bate-papo, natural e contextualizado. (2) Se o usuário pedir expressamente um 'relatório técnico', gere um relatório completo em Markdown. Caso contrário, apenas responda o que foi perguntado de forma clara e fluída. (3) Sempre que solicitado ou se o usuário falar sobre atrasos e planejamento, ofereça proativamente ideias estratégicas de como ajustar a produção.`;


    send({ type: 'step', icon: '🤖', message: `Processando resposta com **${strategistAgent.modelo || 'gemini-2.5-flash'}**...` });
    const finalAnswer = await askGemini(strategistPrompt, finalQuestion, strategistAgent.modelo);

    // ---- STEP 5: Log conversation ----
    send({ type: 'step', icon: '💾', message: 'Salvando conversa no histórico...' });
    try {
        await mysqlPool.query(
            `INSERT INTO pcpmetal_conversas (id_usuario, id_agente, pedido, cliente, produto, mensagem_usuario, resposta_agente, sql_executado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId || 0, strategistAgent.id, requestContext.pedido || null, requestContext.cliente || null, requestContext.produto || null, userMessage, finalAnswer, JSON.stringify(executedSQLs)]
        );
    } catch (logErr) {
        console.error('[Orchestrator] Log error:', logErr.message);
    }

    send({ type: 'done', icon: '🎯', message: 'Relatório gerado com sucesso!' });

    return { answer: finalAnswer, sqlsExecuted: executedSQLs, orderContext };
}

module.exports = { orchestrate, loadAgent, loadAllActiveAgents };
