/**
 * Hermes AI Agent - Orchestrator
 * Manages cognitive loop: query DB, run reasoning steps, execute actions (if autonomous), and generate final response.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mysqlPool = require('../mysqlService');
const { runQuery } = require('./queryRunner');
const { loadSchemaContext, buildSchemaText, buildRequestContext } = require('../pcpmetal/contextBuilder');
const { parseSQLFromResponse } = require('../pcpmetal/geminiClient');
require('dotenv').config();

const MAX_SQL_ROUNDS = 4;

/**
 * Fetch Hermes config from database
 */
async function loadHermesConfig() {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM hermes_config ORDER BY id DESC LIMIT 1');
        return rows[0] || null;
    } catch (err) {
        console.error('[HermesOrchestrator] Falha ao carregar configurações do Hermes:', err.message);
        return null;
    }
}

/**
 * Get configured model instance
 */
function getHermesModel(modelName, temperature = 0.3) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no arquivo .env');
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: modelName || 'gemini-2.5-flash',
        generationConfig: {
            temperature: parseFloat(temperature) ?? 0.3,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
        }
    });
}

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main Hermes cognitive loop orchestration
 */
async function orchestrateHermes({ 
    userMessage, 
    requestContext = {}, 
    pageData = null, 
    userId, 
    historico = [], 
    emit, 
    profileId = null,
    temperature = null,
    autonomia = null
}) {
    const send = emit || (() => {});
    const executedSQLs = [];

    // 1. Load config
    send({ type: 'step', icon: '⚙️', message: 'Carregando configurações do Agente Hermes...' });
    let config = null;
    let globalConfig = await loadHermesConfig();

    if (profileId) {
        const [rows] = await mysqlPool.query('SELECT * FROM pcpmetal_agentes WHERE id = ?', [profileId]);
        if (rows.length > 0) {
            config = {
                system_prompt: rows[0].system_prompt,
                modelo: rows[0].modelo || (globalConfig ? globalConfig.modelo : 'gemini-2.5-flash'),
                temperature: temperature !== null ? temperature : (globalConfig ? globalConfig.temperature : 0.3),
                autonomia: autonomia !== null ? autonomia : (globalConfig ? globalConfig.autonomia : 0)
            };
        }
    }
    
    if (!config) {
        config = {
            system_prompt: globalConfig ? globalConfig.system_prompt : 'Você é Hermes...',
            modelo: globalConfig ? globalConfig.modelo : 'gemini-2.5-flash',
            temperature: temperature !== null ? temperature : (globalConfig ? globalConfig.temperature : 0.3),
            autonomia: autonomia !== null ? autonomia : (globalConfig ? globalConfig.autonomia : 0)
        };
    }

    const { system_prompt, modelo, temperature: tempVal, autonomia: autVal } = config;
    const isAutonomous = !!autVal;

    send({
        type: 'step',
        icon: '🤖',
        message: `Agente Hermes ativo (Modelo: **${modelo}** | Temperatura: **${tempVal}** | Autonomia: **${isAutonomous ? 'ATIVADA' : 'DESATIVADA'}**)`
    });

    // 2. Load schemas & context
    send({ type: 'step', icon: '🗄️', message: 'Construindo o mapa de esquemas de banco...' });
    const schemaRows = await loadSchemaContext();
    const schemaText = buildSchemaText(schemaRows);

    // Build chat context
    const MAX_HIST = 10;
    const recentHistory = historico.slice(-MAX_HIST);
    const historyText = recentHistory.length > 0
        ? '\n\n---\n## HISTÓRICO RECENTE DA CONVERSA:\n' +
          recentHistory.map(h => `**${h.role === 'user' ? 'Usuário' : 'Hermes'}:** ${h.text}`).join('\n\n')
        : '';

    // Request context (pedido, item, etc.)
    const reqCtx = buildRequestContext(requestContext);

    // Custom Hermes rules appending
    const hermesInstructions = `
\n\n## DIRETRIZES DE EXECUÇÃO DO HERMES:
1. Você tem acesso direto para rodar consultas SQL estruturadas usando blocos de código formatados como:
\`\`\`sql
[BANCO: postgresql ou mysql]
SELECT ... (ou UPDATE/INSERT/DELETE se o banco for mysql e autonomia estiver ativada)
\`\`\`
2. REGRAS DE SEGURANÇA:
   - ERP Protheus (postgresql): APENAS consultas SELECT (Leitura). Nunca comandos de escrita. Sempre inclua "d_e_l_e_t_ = ''".
   - App Interno (mysql): Se você precisar atualizar datas de entrega, registrar notas de planejamento ou ajustar saldo, faça comandos de escrita (UPDATE/INSERT), que serão validados pelo validador de autonomia.
3. Se a autonomia estiver DESATIVADA (leia o status acima), você não conseguirá rodar UPDATE/INSERT no banco interno diretamente. Nesse caso, retorne apenas SELECTs para leitura e sugira as alterações textualmente para que o usuário aprove.
4. Responda detalhadamente em Português do Brasil.
5. Você tem acesso a uma ferramenta especial para executar o Motor de Sequenciamento FCS (Capacidade Finita) / Planejamento Inteligente.
   Para executá-lo, retorne um bloco formatado em JSON exatamente como a seguir:
\`\`\`fcs
{
  "data_inicio": "YYYY-MM-DD",
  "ops": ["numero_op_1", "numero_op_2", ...]
}
\`\`\`
Sempre que for solicitado a rodar o planejamento, obter o sequenciamento, fazer o planejamento inteligente, ou atualizar o PCP com base nas capacidades:
a. Primeiro, execute uma consulta SQL no Protheus (postgresql) para encontrar as OPs pendentes (geralmente aquelas onde c2_quant > c2_quje e c2_datare está em branco ou nulo).
b. Depois de receber os dados do SQL, gere o bloco \`\`\`fcs com a lista dessas OPs e a data de início desejada (se o usuário não especificou ou pediu "a data de hoje/do dia", use a data atual do sistema no formato YYYY-MM-DD).
`;

    const fullSystemPrompt = `${system_prompt}${schemaText}${reqCtx}${hermesInstructions}`;

    // Loop variables
    let currentInput = `Mensagem do usuário: "${userMessage}"${historyText}`;
    if (pageData) {
        currentInput += `\n\n### Dados contextuais atuais da tela:\n${JSON.stringify(pageData.ops || pageData || {}).slice(0, 4000)}`;
    }

    let modelInstance = getHermesModel(modelo, tempVal);
    let conversationHistory = [
        { role: 'user', parts: [{ text: fullSystemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido. Sou o Agente Hermes. Estou com os esquemas carregados e pronto para responder perguntas ou executar ações.' }] }
    ];

    let loopRound = 0;
    let finalAnswer = '';
    let hasPendingQueries = true;

    function parseFcsFromResponse(responseText) {
        const fcsRequests = [];
        const regex = /```fcs\s*([\s\S]*?)```/gi;
        let match;

        while ((match = regex.exec(responseText)) !== null) {
            const block = match[1].trim();
            try {
                const parsed = JSON.parse(block);
                if (parsed && parsed.ops && parsed.data_inicio) {
                    fcsRequests.push(parsed);
                }
            } catch (e) {
                console.error('Erro ao fazer o parse do bloco fcs:', e.message);
            }
        }

        return fcsRequests;
    }

    // Cognitive Loop (Max 4 rounds of tool/query execution)
    while (hasPendingQueries && loopRound < MAX_SQL_ROUNDS) {
        loopRound++;
        send({ type: 'step', icon: '🧠', message: `Processando raciocínio - Turno ${loopRound}...` });

        // Add latest user input/db results to chat session
        conversationHistory.push({ role: 'user', parts: [{ text: currentInput }] });

        let modelResponse = '';
        try {
            const chatSession = modelInstance.startChat({ history: conversationHistory });
            // Send message and get text response
            const result = await chatSession.sendMessage(currentInput);
            modelResponse = result.response.text();
        } catch (apiErr) {
            console.error(`[Hermes] Erro na API do Gemini (Turno ${loopRound}):`, apiErr);
            throw new Error(`Falha de comunicação com o Gemini: ${apiErr.message}`);
        }

        // Add response to memory
        conversationHistory.push({ role: 'model', parts: [{ text: modelResponse }] });

        // Parse SQL queries and FCS requests
        const sqlQueries = parseSQLFromResponse(modelResponse);
        const fcsRequests = parseFcsFromResponse(modelResponse);

        if (sqlQueries.length === 0 && fcsRequests.length === 0) {
            // No queries or requests to execute -> loop finished
            finalAnswer = modelResponse;
            hasPendingQueries = false;
        } else {
            let dbResults = '';

            // Execute SQL Queries
            if (sqlQueries.length > 0) {
                send({ type: 'step', icon: '🔍', message: `Detectou ${sqlQueries.length} comando(s) SQL - Executando...` });
                for (let i = 0; i < sqlQueries.length; i++) {
                    const { banco, sql } = sqlQueries[i];
                    const dbLabel = banco === 'postgresql' ? 'Protheus (PostgreSQL)' : 'App Interno (MySQL)';
                    
                    send({
                        type: 'sql',
                        icon: '⚡',
                        message: `Executando no ${dbLabel}`,
                        data: { banco, sql }
                    });

                    try {
                        const result = await runQuery(banco, sql, [], isAutonomous);
                        executedSQLs.push({ banco, sql, rowCount: result.rowCount, success: true });
                        
                        dbResults += `\n\n### Resultado do Comando SQL ${i + 1} (${banco}):\n`;
                        dbResults += `Linhas afetadas/retornadas: ${result.rowCount}\n`;
                        dbResults += `\`\`\`json\n${JSON.stringify((result.rows || []).slice(0, 50), null, 2)}\n\`\`\`\n`;
                        
                        send({ type: 'step', icon: '✅', message: `Comando SQL ${i + 1} executado: ${result.rowCount} registro(s) processado(s)` });
                    } catch (dbErr) {
                        executedSQLs.push({ banco, sql, error: dbErr.message, success: false });
                        dbResults += `\n\n### Erro no Comando SQL ${i + 1} (${banco}):\n${dbErr.message}\n`;
                        send({ type: 'step', icon: '❌', message: `Falha no comando SQL ${i + 1}: ${dbErr.message}` });
                    }
                }
            }

            // Execute FCS Requests
            if (fcsRequests.length > 0) {
                for (let i = 0; i < fcsRequests.length; i++) {
                    let { ops, data_inicio } = fcsRequests[i];

                    // Normalize data_inicio to current date if not valid or requested as "today" / "hoje"
                    if (!data_inicio || data_inicio === 'today' || data_inicio === 'hoje' || data_inicio === 'NOW') {
                        data_inicio = new Date().toISOString().split('T')[0];
                    }

                    // If ops is "*" or "ALL", query all pending OPs
                    if (!ops || ops === '*' || ops === 'ALL' || (Array.isArray(ops) && (ops.length === 0 || ops.includes('*') || ops.includes('ALL')))) {
                        send({
                            type: 'step',
                            icon: '🔍',
                            message: 'Buscando todas as OPs pendentes no Protheus para o planejamento automático...'
                        });
                        const db = require('../db'); // postgres client
                        let pgClient;
                        try {
                            pgClient = await db.connect();
                            const pgRes = await pgClient.query(`
                                SELECT DISTINCT TRIM(c2.c2_num) AS op_num
                                FROM public.sc2010 c2
                                WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
                                  AND c2.c2_quje < c2.c2_quant
                                  AND TRIM(c2.c2_num) <> ''
                                  AND COALESCE(TRIM(c2.c2_pedido), '') <> ''
                                  AND TRIM(c2.c2_itempv) <> ''
                            `);
                            ops = pgRes.rows.map(r => r.op_num);
                            send({
                                type: 'step',
                                icon: '✅',
                                message: `Encontradas ${ops.length} OPs pendentes no Protheus.`
                            });
                        } catch (pgErr) {
                            send({
                                type: 'step',
                                icon: '❌',
                                message: `Erro ao buscar OPs no Protheus: ${pgErr.message}`
                            });
                            dbResults += `\n\n### Erro ao buscar OPs para o FCS (FCS Request ${i + 1}):\n${pgErr.message}\n`;
                            continue;
                        } finally {
                            if (pgClient) pgClient.release();
                        }
                    }

                    send({
                        type: 'step',
                        icon: '🚀',
                        message: `Executando Motor de Sequenciamento FCS para ${ops.length} OPs com data início ${data_inicio}...`
                    });

                    try {
                        const { runFcsSequencing } = require('../fcsEngine');
                        const result = await runFcsSequencing({ ops, data_inicio, usuario: 'Hermes Agent' });
                        
                        dbResults += `\n\n### Resultado do Motor FCS (FCS Request ${i + 1}):\n`;
                        if (result.success) {
                            dbResults += `Sucesso! Planejadas ${result.plans} operações.\n`;
                            dbResults += `\`\`\`json\n${JSON.stringify(result.report || {}, null, 2).slice(0, 2000)}\n\`\`\`\n`;
                            send({ type: 'step', icon: '✅', message: `Motor FCS concluído: ${result.plans} operações planejadas.` });
                        } else {
                            dbResults += `Erro ao rodar motor FCS: ${result.error}\n`;
                            if (result.missing_times) {
                                dbResults += `Tempos em falta:\n\`\`\`json\n${JSON.stringify(result.missing_times, null, 2)}\n\`\`\`\n`;
                            }
                            send({ type: 'step', icon: '❌', message: `Falha no Motor FCS: ${result.error}` });
                        }
                    } catch (fcsErr) {
                        dbResults += `\n\n### Erro ao rodar Motor FCS (FCS Request ${i + 1}):\n${fcsErr.message}\n`;
                        send({ type: 'step', icon: '❌', message: `Erro ao invocar Motor FCS: ${fcsErr.message}` });
                    }
                }
            }

            // Set the outputs as user message for next reasoning turn
            currentInput = `Resultados da execução das ações:\n${dbResults}\n\nAnalise estes resultados e dê sua resposta final ou continue gerando ações se necessário.`;
        }
    }

    if (loopRound >= MAX_SQL_ROUNDS && hasPendingQueries) {
        send({ type: 'step', icon: '⚠️', message: 'Limite de iterações do raciocínio atingido.' });
        // Use the last model output as the final answer
        finalAnswer = conversationHistory[conversationHistory.length - 1].parts[0].text;
    }

    // 5. Store conversation log in DB
    send({ type: 'step', icon: '💾', message: 'Persistindo diálogo na memória do Hermes...' });
    try {
        // User message log
        await mysqlPool.query(
            'INSERT INTO hermes_chat_memory (id_usuario, role, text, sqls_executed) VALUES (?, ?, ?, ?)',
            [userId, 'user', userMessage, null]
        );
        // Model answer log
        await mysqlPool.query(
            'INSERT INTO hermes_chat_memory (id_usuario, role, text, sqls_executed) VALUES (?, ?, ?, ?)',
            [userId, 'model', finalAnswer, JSON.stringify(executedSQLs)]
        );
    } catch (dbLogErr) {
        console.error('[HermesOrchestrator] Falha ao gravar histórico de chat:', dbLogErr.message);
    }

    send({ type: 'done', icon: '🎯', message: 'Atendimento concluído!' });
    return { answer: finalAnswer, sqlsExecuted: executedSQLs };
}

module.exports = { orchestrateHermes };
