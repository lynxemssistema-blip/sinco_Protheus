/**
 * PCPMetal - API Routes
 * Handles agent management, conversations, and schema configuration.
 */
const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const { orchestrate, loadAllActiveAgents } = require('../services/pcpmetal/orchestrator');
const { loadSchemaContext } = require('../services/pcpmetal/contextBuilder');
const SCHEMA_CONTEXT = require('../services/pcpmetal/schemaContext');
const pgDb = require('../db');

// ========= DATABASE INITIALIZATION =========
const initPCPMetal = async () => {
    try {
        // Table: Agents
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS pcpmetal_agentes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                papel ENUM('orquestrador','analista_sql','estrategista','especialista') DEFAULT 'especialista',
                system_prompt TEXT NOT NULL,
                contexto_negocio TEXT,
                modelo VARCHAR(50) DEFAULT 'gemini-2.0-flash',
                ativo TINYINT DEFAULT 1,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Table: Conversations
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS pcpmetal_conversas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT UNSIGNED,
                id_agente INT,
                pedido VARCHAR(20),
                cliente VARCHAR(100),
                produto VARCHAR(100),
                mensagem_usuario TEXT NOT NULL,
                resposta_agente TEXT NOT NULL,
                sql_executado TEXT,
                tokens_usados INT,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Table: Schema Context
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS pcpmetal_schema_context (
                id INT AUTO_INCREMENT PRIMARY KEY,
                banco ENUM('postgresql','mysql') NOT NULL,
                tabela VARCHAR(100) NOT NULL,
                descricao TEXT NOT NULL,
                colunas_chave TEXT,
                ativo TINYINT DEFAULT 1,
                UNIQUE KEY uq_banco_tabela (banco, tabela)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Seed default agents if table is empty
        const [agentRows] = await mysqlPool.query('SELECT COUNT(*) as cnt FROM pcpmetal_agentes');
        if (agentRows[0].cnt === 0) {
            await mysqlPool.query(`
                INSERT INTO pcpmetal_agentes (nome, papel, system_prompt, contexto_negocio, modelo) VALUES
                (
                    'Analista SQL PCPMetal',
                    'analista_sql',
                    'Você é um Analista de Dados especialista no ERP Protheus (PostgreSQL) e no banco de dados interno da MetalFisa (MySQL). Sua função é receber uma pergunta do usuário e das informações de contexto, e gerar as consultas SQL SELECT necessárias para coletar todos os dados relevantes. Você entende profundamente as tabelas SC5010, SC6010, SC9010, SH6010, SA1010, SB1010 do Protheus, e as tabelas internas do App MetalFisa (como app_production_planning). Sempre filtre d_e_l_e_t_ = \\'\\' nas tabelas Protheus. Gere SQL limpo, eficiente e seguro. Você TEM PERMISSÃO para gerar comandos UPDATE e INSERT no banco MySQL para alterar planejamento (ex: tabela app_production_planning) quando o usuário solicitar mudanças ou otimizações, mas NUNCA no PostgreSQL (Protheus).',
                    'A MetalFisa é uma indústria metalúrgica brasileira. Trabalha com pedidos de venda que envolvem produtos fabricados internamente. O PCP (Planejamento e Controle da Produção) precisa monitorar constantemente o andamento das Ordens de Produção vs datas de entrega comprometidas com os clientes.',
                    'gemini-2.5-flash'
                ),
                (
                    'Estrategista PCPMetal',
                    'estrategista',
                    'Você é PCPMetal, o assistente estrategista de Planejamento e Controle da Produção da MetalFisa. Você recebe dados coletados do banco e elabora relatórios técnicos completos. Foco: entender a estrutura completa de cada OP e seus filhos, respeitando a sequência de fabricação e recursos. Você deve definir a melhor estratégia de produção, propondo antecipar (puxar) a carga de dias futuros para o dia atual quando houver capacidade ociosa disponível. Você pode alertar o usuário com dicas importantes e tem autorização para emitir comandos que alterem o planejamento (solicitando ao Analista SQL). Seus relatórios devem permitir que o usuário interaja e comente para novas análises.',
                    'A MetalFisa opera com lead times de produção que variam de 10 a 90 dias dependendo da complexidade do produto. Priorize pedidos com data de entrega mais próxima. Considere que a engenharia precisa de pelo menos 3 dias para liberar BOM antes de iniciar a produção.',
                    'gemini-2.5-flash'
                ),
                (
                    'Orquestrador PCPMetal',
                    'orquestrador',
                    'Você é o orquestrador do ecossistema PCPMetal. Coordene os agentes especialistas, delegue tarefas de coleta de dados ao Analista SQL e de análise ao Estrategista. Consolide as respostas em um relatório final coerente.',
                    NULL,
                    'gemini-2.5-flash'
                ),
                (
                    'Planejamento Inteligente',
                    'especialista',
                    'Você é um especialista sênior em Planejamento e Controle da Produção (PCP) industrial para a MetalFisa. Seu papel é analisar o resultado de um planejamento gerado pelo algoritmo FCS (Finite Capacity Scheduling) e fornecer uma análise técnica aprofundada, cruzando dados históricos e de carga futura para identificar riscos de atrasos ou gargalos.',
                    'A MetalFisa opera com lead times de 10 a 90 dias úteis. O motor FCS assume dias úteis (segunda a sexta) para o cálculo de capacidade de produção. Prazos e prioridades de entrega de pedidos urgentes devem guiar as análises de antecedência de carga.',
                    'gemini-2.5-flash'
                )
            `);
            console.log('✅ [PCPMetal] Agentes padrão inseridos.');
        } else {
            // Migrate any unavailable/preview model names to the stable default
            await mysqlPool.query(
                "UPDATE pcpmetal_agentes SET modelo = 'gemini-2.5-flash' WHERE modelo NOT IN ('gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash-001','gemini-2.0-flash-lite')"
            );

            // Migração: garantir que o agente 'Planejamento Inteligente' existe
            const [piExists] = await mysqlPool.query("SELECT COUNT(*) as cnt FROM pcpmetal_agentes WHERE nome = 'Planejamento Inteligente'");
            if (piExists[0].cnt === 0) {
                await mysqlPool.query(`
                    INSERT INTO pcpmetal_agentes (nome, papel, system_prompt, contexto_negocio, modelo) VALUES
                    (
                        'Planejamento Inteligente',
                        'especialista',
                        'Você é um especialista sênior em Planejamento e Controle da Produção (PCP) industrial para a MetalFisa. Seu papel é analisar o resultado de um planejamento gerado pelo algoritmo FCS (Finite Capacity Scheduling) e fornecer uma análise técnica aprofundada, cruzando dados históricos e de carga futura para identificar riscos de atrasos ou gargalos.',
                        'A MetalFisa opera com lead times de 10 a 90 dias úteis. O motor FCS assume dias úteis (segunda a sexta) para o cálculo de capacidade de produção. Prazos e prioridades de entrega de pedidos urgentes devem guiar as análises de antecedência de carga.',
                        'gemini-2.5-flash'
                    )
                `);
                console.log('✅ [PCPMetal] Agente Planejamento Inteligente inserido via migração.');
            }
        }

        // Seed schema context if empty
        const [schemaRows] = await mysqlPool.query('SELECT COUNT(*) as cnt FROM pcpmetal_schema_context');
        if (schemaRows[0].cnt === 0) {
            for (const ctx of SCHEMA_CONTEXT) {
                await mysqlPool.query(
                    `INSERT IGNORE INTO pcpmetal_schema_context (banco, tabela, descricao, colunas_chave) VALUES (?, ?, ?, ?)`,
                    [ctx.banco, ctx.tabela, ctx.descricao, ctx.colunas_chave || null]
                );
            }
            console.log('✅ [PCPMetal] Schema context padrão inserido.');
        }

        console.log('✅ [PCPMetal] Tabelas verificadas/criadas com sucesso.');
    } catch (err) {
        console.error('❌ [PCPMetal] Erro na inicialização:', err.message);
    }
};

// Delay init to avoid competing for MySQL connections during server boot
setTimeout(initPCPMetal, 3000);

// ========= AGENT MANAGEMENT =========

// GET /api/pcpmetal/agentes — List all agents
router.get('/agentes', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM pcpmetal_agentes ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pcpmetal/agentes/:id — Get agent detail
router.get('/agentes/:id', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM pcpmetal_agentes WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Agente não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pcpmetal/agentes — Create agent
router.post('/agentes', async (req, res) => {
    try {
        const { nome, papel, system_prompt, contexto_negocio, modelo } = req.body;
        if (!nome || !system_prompt) return res.status(400).json({ error: 'nome e system_prompt são obrigatórios.' });
        const [result] = await mysqlPool.query(
            'INSERT INTO pcpmetal_agentes (nome, papel, system_prompt, contexto_negocio, modelo) VALUES (?, ?, ?, ?, ?)',
            [nome, papel || 'especialista', system_prompt, contexto_negocio || null, modelo || 'gemini-2.0-flash']
        );
        res.status(201).json({ id: result.insertId, message: 'Agente criado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/pcpmetal/agentes/:id — Update agent
router.put('/agentes/:id', async (req, res) => {
    try {
        const { nome, papel, system_prompt, contexto_negocio, modelo, ativo } = req.body;
        await mysqlPool.query(
            'UPDATE pcpmetal_agentes SET nome=?, papel=?, system_prompt=?, contexto_negocio=?, modelo=?, ativo=? WHERE id=?',
            [nome, papel, system_prompt, contexto_negocio || null, modelo || 'gemini-2.0-flash', ativo !== undefined ? ativo : 1, req.params.id]
        );
        res.json({ message: 'Agente atualizado com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/pcpmetal/agentes/:id — Delete agent
router.delete('/agentes/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM pcpmetal_agentes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Agente removido.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========= SCHEMA CONTEXT MANAGEMENT =========

// GET /api/pcpmetal/schema — List schema context
router.get('/schema', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM pcpmetal_schema_context ORDER BY banco, tabela');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/pcpmetal/schema/:id — Update schema entry
router.put('/schema/:id', async (req, res) => {
    try {
        const { banco, tabela, descricao, colunas_chave, ativo } = req.body;
        await mysqlPool.query(
            'UPDATE pcpmetal_schema_context SET banco=?, tabela=?, descricao=?, colunas_chave=?, ativo=? WHERE id=?',
            [banco, tabela, descricao, colunas_chave || null, ativo !== undefined ? ativo : 1, req.params.id]
        );
        res.json({ message: 'Schema atualizado.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pcpmetal/schema — Add new schema entry
router.post('/schema', async (req, res) => {
    try {
        const { banco, tabela, descricao, colunas_chave } = req.body;
        if (!banco || !tabela || !descricao) return res.status(400).json({ error: 'banco, tabela e descricao são obrigatórios.' });
        const [result] = await mysqlPool.query(
            'INSERT INTO pcpmetal_schema_context (banco, tabela, descricao, colunas_chave) VALUES (?, ?, ?, ?)',
            [banco, tabela, descricao, colunas_chave || null]
        );
        res.status(201).json({ id: result.insertId, message: 'Schema adicionado.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/pcpmetal/schema/:id — Remove schema entry
router.delete('/schema/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM pcpmetal_schema_context WHERE id=?', [req.params.id]);
        res.json({ message: 'Schema removido.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pcpmetal/schema/sync — Synchronize database structures into pcpmetal_schema_context
router.post('/schema/sync', async (req, res) => {
    let pgClient;
    try {
        // 1. Fetch current schema context
        const [rows] = await mysqlPool.query('SELECT * FROM pcpmetal_schema_context');
        
        let pgConnected = false;
        try {
            pgClient = await pgDb.connect();
            pgConnected = true;
        } catch (err) {
            console.warn('⚠️ Não foi possível conectar ao PostgreSQL (Protheus) para sincronizar schemas:', err.message);
        }

        const report = [];

        for (const row of rows) {
            let colMap = {};
            try {
                if (row.colunas_chave) {
                    colMap = JSON.parse(row.colunas_chave);
                }
            } catch (_) {
                colMap = {};
            }

            let columnsFound = [];

            if (row.banco === 'postgresql') {
                if (!pgConnected) {
                    report.push({ tabela: row.tabela, banco: row.banco, status: 'Ignorado (Sem conexão PG)' });
                    continue;
                }
                const pgRes = await pgClient.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE LOWER(table_name) = LOWER($1) 
                      AND table_schema = 'public'
                `, [row.tabela]);
                
                columnsFound = pgRes.rows.map(c => ({
                    name: c.column_name,
                    description: `Tipo: ${c.data_type}`
                }));
            } else if (row.banco === 'mysql') {
                const [mysqlRes] = await mysqlPool.query(`
                    SELECT column_name, column_type, column_comment 
                    FROM information_schema.columns 
                    WHERE LOWER(table_name) = LOWER(?) 
                      AND table_schema = DATABASE()
                `, [row.tabela]);
                
                columnsFound = mysqlRes.map(c => ({
                    name: c.column_name,
                    description: c.column_comment?.trim() || `Tipo: ${c.column_type}`
                }));
            }

            if (columnsFound.length === 0) {
                report.push({ tabela: row.tabela, banco: row.banco, status: 'Não encontrada no banco real' });
                continue;
            }

            // Sync columns
            let updated = false;
            for (const col of columnsFound) {
                if (!colMap[col.name]) {
                    colMap[col.name] = col.description;
                    updated = true;
                }
            }

            if (updated) {
                const updatedJson = JSON.stringify(colMap);
                await mysqlPool.query(
                    'UPDATE pcpmetal_schema_context SET colunas_chave = ? WHERE id = ?',
                    [updatedJson, row.id]
                );
                report.push({ tabela: row.tabela, banco: row.banco, status: 'Sincronizada (Novas colunas adicionadas)' });
            } else {
                report.push({ tabela: row.tabela, banco: row.banco, status: 'Já atualizada' });
            }
        }

        res.json({ message: 'Sincronização concluída com sucesso.', report });
    } catch (err) {
        console.error('❌ Erro na sincronização do schema:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// ========= CONVERSATIONS =========

// GET /api/pcpmetal/conversas — List conversations (recent)
router.get('/conversas', async (req, res) => {
    try {
        const { pedido, limit = 20 } = req.query;
        let query = `
            SELECT c.*, a.nome as nome_agente, u.NomeCompleto as nome_usuario
            FROM pcpmetal_conversas c
            LEFT JOIN pcpmetal_agentes a ON a.id = c.id_agente
            LEFT JOIN usuario u ON u.idUsuario = c.id_usuario
        `;
        const params = [];
        if (pedido) { query += ' WHERE c.pedido = ?'; params.push(pedido); }
        query += ' ORDER BY c.criado_em DESC LIMIT ?';
        params.push(parseInt(limit));
        const [rows] = await mysqlPool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========= PROMPT COPILOT =========

// POST /api/pcpmetal/prompt-copilot — Streaming AI assistant for writing/improving agent prompts
router.post('/prompt-copilot', async (req, res) => {
    const { userMessage, currentText, fieldType, agentRole, agentNome, historico = [] } = req.body;
    if (!userMessage?.trim()) { res.status(400).json({ error: 'Mensagem obrigatória.' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (data) => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); if (res.flush) res.flush(); } catch (_) { } };

    const fieldLabel = fieldType === 'system_prompt' ? 'System Prompt' : 'Contexto de Negócio';
    const roleLabel = { analista_sql: 'Analista SQL', estrategista: 'Estrategista', orquestrador: 'Orquestrador', especialista: 'Especialista' }[agentRole] || agentRole;

    const SYSTEM = `Você é um especialista em engenharia de prompts para sistemas de IA industrial aplicada ao PCP (Planejamento e Controle da Produção).
Sua missão: ajudar a criar e aprimorar o campo "${fieldLabel}" do agente "${agentNome || roleLabel}" (papel: ${roleLabel}) no sistema PCPMetal da MetalFisa.

## SOBRE O SISTEMA PCPMETAL
Sistema multi-agente de IA para PCP de uma indústria metalúrgica brasileira (MetalFisa).
Acesso a dois bancos:
- PostgreSQL/Protheus: SC5010 (pedidos), SC6010 (itens), SC9010 (OPs), SH6010 (roteiros), SA1010 (clientes), SB1010 (produtos) — sempre filtrar d_e_l_e_t_ = ''
- MySQL/App MetalFisa: app_production_appointments, app_production_planning, producao_apontamentos, sistema_avisos

## PAPEL DO AGENTE: ${roleLabel}
${agentRole === 'analista_sql' ? '• Recebe perguntas e gera SQL SELECT para coletar dados\n• Nunca gera UPDATE/INSERT/DELETE\n• Deve conhecer tabelas e joins dos dois bancos' : ''}
${agentRole === 'estrategista' ? '• Recebe dados do Analista e gera relatórios técnicos de PCP\n• Foco: status de fabricação, risco de atraso, saldo a produzir, estratégia\n• Sempre em Português (Brasil), em Markdown estruturado' : ''}
${agentRole === 'orquestrador' ? '• Coordena Analista + Estrategista\n• Consolida respostas em relatório coerente' : ''}

## CAMPO SENDO EDITADO: ${fieldLabel}
${fieldType === 'system_prompt' ? '• Define personalidade, regras e capacidades do agente\n• Deve ser preciso, abrangente, guiar claramente o LLM' : '• Contexto de negócio injetado junto ao prompt\n• Regras da MetalFisa: lead times, prioridades, restrições operacionais'}

## TEXTO ATUAL DO CAMPO (base para revisão):
${currentText?.trim() ? '```\n' + currentText + '\n```' : '(campo vazio — crie do zero)'}

## REGRAS DE RESPOSTA
- Converse naturalmente, responda perguntas sobre como melhorar o prompt
- Quando sugerir um texto completo, envolva com marcadores exatos:
  [PROMPT_SUGERIDO]
  texto aqui
  [/PROMPT_SUGERIDO]
- Isso permite aplicar com um clique
- Responda sempre em Português (Brasil)`;

    const histCtx = historico.slice(-8).map(h => `**${h.role === 'user' ? 'Usuário' : 'Assistente'}:** ${h.text}`).join('\n\n');
    const fullPrompt = `${SYSTEM}${histCtx ? '\n\n## HISTÓRICO:\n' + histCtx : ''}\n\n## MENSAGEM DO USUÁRIO:\n${userMessage}`;

    try {
        const { askGemini } = require('../services/pcpmetal/geminiClient');
        const answer = await askGemini(fullPrompt, '', 'gemini-2.5-flash');
        send({ type: 'result', answer });
    } catch (err) {
        send({ type: 'error', message: err.message });
    } finally {
        res.end();
    }
});

// ========= MAIN QUERY ENDPOINTS =========

// POST /api/pcpmetal/ask — Classic JSON endpoint (non-streaming)
router.post('/ask', async (req, res) => {
    try {
        const { pergunta, pedido, item, cliente, produto, userId } = req.body;
        if (!pergunta || !pergunta.trim()) return res.status(400).json({ error: 'Informe uma pergunta.' });

        const result = await orchestrate({
            userMessage: pergunta,
            requestContext: { pedido, item, cliente, produto },
            userId: userId || 0
        });

        res.json(result);
    } catch (err) {
        console.error('❌ [PCPMetal] Error in /ask:', err);
        res.status(500).json({ error: `Erro no PCPMetal: ${err.message}` });
    }
});

// POST /api/pcpmetal/ask-stream — SSE streaming via POST (fetch + ReadableStream)
// Accepts history in body so multi-turn context works without URL limits.
router.post('/ask-stream', async (req, res) => {
    const { pergunta, pedido, item, cliente, produto, userId, historico = [], pageData = null } = req.body;

    if (!pergunta || !pergunta.trim()) {
        res.status(400).json({ error: 'Informe uma pergunta.' });
        return;
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data) => {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
            if (res.flush) res.flush();
        } catch (_) { /* client disconnected */ }
    };

    sendEvent({ type: 'connected', message: 'Conexão estabelecida' });

    try {
        const result = await orchestrate({
            userMessage: pergunta,
            requestContext: { pedido, item, cliente, produto },
            pageData,           // ← dados da página controle-producao
            userId: parseInt(userId) || 0,
            historico,
            emit: sendEvent
        });

        sendEvent({ type: 'result', answer: result.answer, sqlsExecuted: result.sqlsExecuted });
    } catch (err) {
        console.error('❌ [PCPMetal] SSE stream error:', err);
        sendEvent({ type: 'error', message: err.message });
    } finally {
        res.end();
    }
});


module.exports = router;


