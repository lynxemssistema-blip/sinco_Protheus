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
 * @param {number} params.userId
 * @param {Function} [params.emit] - optional SSE callback: emit({ type, message, data? })
 */
async function orchestrate({ userMessage, requestContext = {}, userId, historico = [], emit }) {
    const send = emit || (() => { });
    const executedSQLs = [];

    // Build conversation history suffix for prompt context (last 6 turns)
    const MAX_HIST = 6;
    const recentHistory = historico.slice(-MAX_HIST);
    const historyContext = recentHistory.length > 0
        ? '\n\n---\n## HISTÓRICO DESTA CONVERSA (use como contexto):\n' +
        recentHistory.map(h => `**${h.role === 'user' ? 'Usuário' : 'PCPMetal'}:** ${h.text}`).join('\n\n')
        : '';

    // ---- STEP 1: Load schema and order context ----
    send({ type: 'step', icon: '🗂️', message: 'Carregando contexto e esquema dos bancos de dados...' });
    const schemaRows = await loadSchemaContext();

    let orderContext = null;
    if (requestContext.pedido) {
        send({ type: 'step', icon: '📦', message: `Buscando dados do pedido ${requestContext.pedido.trim()}...` });
        orderContext = await getOrderContext(requestContext.pedido, requestContext.item);
        if (orderContext) {
            const itemCount = orderContext.itens?.length || 0;
            send({ type: 'step', icon: '✅', message: `Pedido encontrado — ${itemCount} item(s) carregado(s)` });
        }
    }

    // ---- STEP 2: SQL Analyst Phase ----
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
    const analystQuestion = `Pergunta do usuário: "${userMessage}"${historyContext}\n\nGenere as consultas SQL necessárias para obter TODOS os dados relevantes para responder essa pergunta. Execute no máximo ${MAX_SQL_ROUNDS} consultas. Formato: \`\`\`sql\n[BANCO: postgresql ou mysql]\nSELECT...\n\`\`\``;

    const analystResponse = await askGemini(analystPrompt, analystQuestion, analystAgent.modelo);

    // ---- STEP 3: Execute generated SQL queries ----
    const sqlQueries = parseSQLFromResponse(analystResponse);
    const queryResults = [];

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
            const result = await runQuery(banco, sql);
            queryResults.push({ banco, sql, rows: result.rows, rowCount: result.rowCount, error: null });
            executedSQLs.push({ banco, sql, rowCount: result.rowCount });
            send({ type: 'step', icon: '✅', message: `Consulta ${i + 1} retornou **${result.rowCount}** linha(s)` });
        } catch (err) {
            queryResults.push({ banco, sql, rows: [], rowCount: 0, error: err.message });
            executedSQLs.push({ banco, sql, error: err.message });
            send({ type: 'step', icon: '❌', message: `Consulta ${i + 1} falhou: ${err.message}` });
        }
    }

    // ---- STEP 4: Strategist Phase ----
    send({ type: 'step', icon: '🧠', message: 'Estrategista PCPMetal analisando os dados coletados...' });

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
    const dataForStrategist = queryResults.map((qr, idx) => {
        const rows = qr.rows || [];
        const preview = JSON.stringify(rows.slice(0, 50), null, 2);
        return `### Resultado ${idx + 1} (${qr.banco}):\nSQL: \`${qr.sql}\`\n${qr.error ? `ERRO: ${qr.error}` : `${qr.rowCount} linha(s):\n\`\`\`json\n${preview}\n\`\`\``}`;
    }).join('\n\n');

    const finalQuestion = `Pergunta original: "${userMessage}"${historyContext}\n\n${dataForStrategist ? `DADOS COLETADOS:\n${dataForStrategist}` : 'Nenhuma consulta executada.'}\n\nElabore um relatório técnico completo de PCP em Markdown com: Resumo Executivo, Análise de Prazo, Quantidade Faltante, Estratégia e Alertas. Responda em Português (Brasil).`;

    send({ type: 'step', icon: '💬', message: `Gerando relatório com **${strategistAgent.modelo || 'gemini-2.5-flash'}**...` });
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
