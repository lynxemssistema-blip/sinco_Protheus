/**
 * Hermes AI Agent - API Routes
 * Handles agent configuration, profiles, scheduling, chat memory, and analytics.
 */
const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const { orchestrateHermes } = require('../services/hermes/orchestrator');

// ========= DATABASE INITIALIZATION =========
const initHermes = async () => {
    try {
        // Table: Config (Global Default)
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS hermes_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                system_prompt TEXT NOT NULL,
                modelo VARCHAR(50) DEFAULT 'gemini-2.5-flash',
                temperature FLOAT DEFAULT 0.3,
                autonomia TINYINT DEFAULT 0,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Table: Chat Memory / History
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS hermes_chat_memory (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT UNSIGNED,
                role ENUM('user', 'model', 'system', 'agent', 'thinking', 'error') NOT NULL,
                text TEXT NOT NULL,
                sqls_executed TEXT,
                tokens_usados INT,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Clean up obsolete Agent Profiles table
        await mysqlPool.query('DROP TABLE IF EXISTS hermes_agent_profiles');

        // Table: Scheduled Tasks (Tarefas Agendadas)
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS hermes_tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(150) NOT NULL,
                descricao TEXT,
                perfil_id INT NULL, -- references pcpmetal_agentes.id
                cron_expression VARCHAR(100) NOT NULL,
                prompt_execucao TEXT NOT NULL,
                alerta_email VARCHAR(255) NULL,
                alerta_whatsapp VARCHAR(50) NULL,
                temperature FLOAT DEFAULT 0.3,
                autonomia TINYINT DEFAULT 0,
                ativo TINYINT DEFAULT 1,
                last_run DATETIME NULL,
                status_last_run VARCHAR(50) NULL,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Check and add columns if they don't exist
        const [columns] = await mysqlPool.query('SHOW COLUMNS FROM hermes_tasks');
        const colNames = new Set(columns.map(c => c.Field));

        if (!colNames.has('temperature'))
            await mysqlPool.query('ALTER TABLE hermes_tasks ADD COLUMN temperature FLOAT DEFAULT 0.3');
        if (!colNames.has('autonomia'))
            await mysqlPool.query('ALTER TABLE hermes_tasks ADD COLUMN autonomia TINYINT DEFAULT 0');
        if (!colNames.has('last_output'))
            await mysqlPool.query('ALTER TABLE hermes_tasks ADD COLUMN last_output LONGTEXT NULL');

        // Seed default config if empty
        const [configRows] = await mysqlPool.query('SELECT COUNT(*) as cnt FROM hermes_config');
        if (configRows[0].cnt === 0) {
            await mysqlPool.query(`
                INSERT INTO hermes_config (system_prompt, modelo, temperature, autonomia) VALUES
                (
                    'Você é Hermes, o agente inteligente e assistente analítico da MetalFisa. Sua missão é apoiar a tomada de decisões de produção e planejar operações na fábrica, analisando dados de produção em tempo real. Você pode fazer consultas ao banco de dados e propor alterações.',
                    'gemini-2.5-flash',
                    0.3,
                    0
                )
            `);
            console.log('✅ [Hermes] Configuração padrão inserida.');
        }

        console.log('✅ [Hermes] Tabelas verificadas/criadas com sucesso.');
    } catch (err) {
        console.error('❌ [Hermes] Erro na inicialização do banco:', err.message);
    }
};

// Delay init to avoid startup connections lock
setTimeout(initHermes, 3000);

// ========= CONFIGURATION ENDPOINTS (Super Admin Access only) =========

// GET /api/hermes/config
router.get('/config', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        const [rows] = await mysqlPool.query('SELECT * FROM hermes_config ORDER BY id DESC LIMIT 1');
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Configurações do Hermes não encontradas.' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/hermes/config
router.put('/config', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        const { system_prompt, modelo, temperature, autonomia } = req.body;
        if (!system_prompt) {
            return res.status(400).json({ error: 'system_prompt é obrigatório.' });
        }

        const temp = parseFloat(temperature);
        if (isNaN(temp) || temp < 0 || temp > 2) {
            return res.status(400).json({ error: 'A temperatura deve ser um número entre 0 e 2.' });
        }

        const [config] = await mysqlPool.query('SELECT id FROM hermes_config ORDER BY id DESC LIMIT 1');
        if (config.length > 0) {
            await mysqlPool.query(
                'UPDATE hermes_config SET system_prompt=?, modelo=?, temperature=?, autonomia=? WHERE id=?',
                [system_prompt, modelo || 'gemini-2.5-flash', temp, autonomia ? 1 : 0, config[0].id]
            );
        } else {
            await mysqlPool.query(
                'INSERT INTO hermes_config (system_prompt, modelo, temperature, autonomia) VALUES (?, ?, ?, ?)',
                [system_prompt, modelo || 'gemini-2.5-flash', temp, autonomia ? 1 : 0]
            );
        }
        res.json({ message: 'Configurações do Hermes salvas com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========= CHAT & MEMORY ENDPOINTS =========

// GET /api/hermes/chat/history
router.get('/chat/history', async (req, res) => {
    try {
        const userId = req.user?.id || 0;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM hermes_chat_memory WHERE id_usuario = ? ORDER BY criado_em ASC LIMIT 50',
            [userId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/hermes/chat/clear
router.post('/chat/clear', async (req, res) => {
    try {
        const userId = req.user?.id || 0;
        await mysqlPool.query('DELETE FROM hermes_chat_memory WHERE id_usuario = ?', [userId]);
        res.json({ message: 'Histórico do Hermes limpo com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/hermes/chat-stream (SSE streaming)
router.post('/chat-stream', async (req, res) => {
    const { pergunta, pedido, item, cliente, produto, historico = [], pageData = null, profileId = null } = req.body;
    const userId = req.user?.id || 0;

    if (!pergunta || !pergunta.trim()) {
        return res.status(400).json({ error: 'A pergunta é obrigatória.' });
    }

    const normalized = pergunta.toLowerCase().trim();
    if (normalized.includes('imagem') || normalized.includes('image')) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const sendEvent = (data) => {
            try {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
                if (res.flush) res.flush();
            } catch (_) {}
        };

        sendEvent({ type: 'connected', message: 'Conectado ao Agente Hermes' });
        
        sendEvent({ type: 'reasoning', message: 'Analisando solicitação de exemplo de imagem...' });
        await new Promise(resolve => setTimeout(resolve, 300));
        sendEvent({ type: 'reasoning', message: 'Buscando imagem ilustrativa da visão de fábrica no PCP...' });
        await new Promise(resolve => setTimeout(resolve, 300));
        sendEvent({ type: 'reasoning', message: 'Gerando resposta formatada com Markdown...' });
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const answer = `Claro! Aqui está uma demonstração de como o Lynx renderiza e formata imagens responsivas no chat.\n\n` +
                       `### Visão Geral da Fábrica (PCP)\n\n` +
                       `Esta imagem ilustra o painel de ocupação e planejamento da fábrica:\n\n` +
                       `![Visão Geral do PCP](/help-images/pcp_visao_fabrica.png)\n\n` +
                       `### Principais Recursos:\n` +
                       `1. **Ajuste Dinâmico:** A imagem se adapta ao tamanho disponível na tela.\n` +
                       `2. **Ampliação ao Clicar:** Clique na imagem para abri-la em tela cheia.\n` +
                       `3. **Qualidade Visual:** Mantém a proporção e adiciona bordas elegantes.`;

        // Save mock turns to DB if orchestrateHermes would
        try {
            await mysqlPool.query(
                'INSERT INTO hermes_chat_memory (id_usuario, role, text) VALUES (?, ?, ?)',
                [userId, 'user', pergunta]
            );
            await mysqlPool.query(
                'INSERT INTO hermes_chat_memory (id_usuario, role, text) VALUES (?, ?, ?)',
                [userId, 'model', answer]
            );
        } catch (dbErr) {
            console.error('Erro ao salvar mock no histórico:', dbErr);
        }

        sendEvent({ type: 'result', answer, sqlsExecuted: [] });
        res.end();
        return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data) => {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
            if (res.flush) res.flush();
        } catch (_) { /* connection closed */ }
    };

    sendEvent({ type: 'connected', message: 'Conectado ao Agente Hermes' });

    try {
        const result = await orchestrateHermes({
            userMessage: pergunta,
            requestContext: { pedido, item, cliente, produto },
            pageData,
            userId,
            historico,
            emit: sendEvent,
            profileId
        });

        sendEvent({ type: 'result', answer: result.answer, sqlsExecuted: result.sqlsExecuted });
    } catch (err) {
        console.error('❌ [Hermes] Erro durante o chat-stream:', err);
        sendEvent({ type: 'error', message: err.message });
    } finally {
        res.end();
    }
});

// ==========================================
// AGENT PROFILES ENDPOINTS
// ==========================================

// GET /api/hermes/profiles
// Reuses the existing pcpmetal_agentes list of agents as behavior profiles for tasks.
router.get('/profiles', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        // Fetch all active agents from pcpmetal_agentes
        const [rows] = await mysqlPool.query('SELECT id, nome, system_prompt, modelo FROM pcpmetal_agentes WHERE ativo = 1 ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SCHEDULED TASKS ENDPOINTS
// ==========================================

const { scheduleTaskInstance, stopTaskInstance, executeTaskImmediately } = require('../services/hermes/scheduler');

// GET /api/hermes/tasks
router.get('/tasks', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        const [rows] = await mysqlPool.query(`
            SELECT t.*, p.nome as perfil_nome 
            FROM hermes_tasks t
            LEFT JOIN pcpmetal_agentes p ON p.id = t.perfil_id
            ORDER BY t.id DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/hermes/tasks
router.post('/tasks', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        const { nome, descricao, perfil_id, cron_expression, prompt_execucao, alerta_email, alerta_whatsapp, temperature, autonomia } = req.body;
        if (!nome || !cron_expression || !prompt_execucao) {
            return res.status(400).json({ error: 'Nome, expressão cron e prompt de execução são obrigatórios.' });
        }

        const tempParsed = parseFloat(temperature);
        const temp = isNaN(tempParsed) ? 0.3 : tempParsed;
        const aut = autonomia ? 1 : 0;

        const [result] = await mysqlPool.query(
            'INSERT INTO hermes_tasks (nome, descricao, perfil_id, cron_expression, prompt_execucao, alerta_email, alerta_whatsapp, temperature, autonomia, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [nome, descricao || null, perfil_id || null, cron_expression, prompt_execucao, alerta_email || null, alerta_whatsapp || null, temp, aut]
        );

        const [newTask] = await mysqlPool.query('SELECT * FROM hermes_tasks WHERE id = ?', [result.insertId]);
        if (newTask.length > 0) {
            scheduleTaskInstance(newTask[0]);
        }

        res.json({ id: result.insertId, message: 'Tarefa criada e agendada com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/hermes/tasks/:id
router.put('/tasks/:id', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        const { id } = req.params;
        const { nome, descricao, perfil_id, cron_expression, prompt_execucao, alerta_email, alerta_whatsapp, temperature, autonomia, ativo } = req.body;
        if (!nome || !cron_expression || !prompt_execucao) {
            return res.status(400).json({ error: 'Nome, expressão cron e prompt de execução são obrigatórios.' });
        }

        const tempParsed = parseFloat(temperature);
        const temp = isNaN(tempParsed) ? 0.3 : tempParsed;
        const aut = autonomia ? 1 : 0;

        await mysqlPool.query(
            'UPDATE hermes_tasks SET nome=?, descricao=?, perfil_id=?, cron_expression=?, prompt_execucao=?, alerta_email=?, alerta_whatsapp=?, temperature=?, autonomia=?, ativo=? WHERE id=?',
            [nome, descricao || null, perfil_id || null, cron_expression, prompt_execucao, alerta_email || null, alerta_whatsapp || null, temp, aut, ativo ? 1 : 0, id]
        );

        const [updatedTask] = await mysqlPool.query('SELECT * FROM hermes_tasks WHERE id = ?', [id]);
        if (updatedTask.length > 0) {
            if (updatedTask[0].ativo) {
                scheduleTaskInstance(updatedTask[0]);
            } else {
                stopTaskInstance(parseInt(id));
            }
        }

        res.json({ message: 'Tarefa atualizada com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/hermes/tasks/:id/toggle
router.post('/tasks/:id/toggle', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        const { id } = req.params;
        const { ativo } = req.body;

        await mysqlPool.query('UPDATE hermes_tasks SET ativo = ? WHERE id = ?', [ativo ? 1 : 0, id]);

        const [updatedTask] = await mysqlPool.query('SELECT * FROM hermes_tasks WHERE id = ?', [id]);
        if (updatedTask.length > 0) {
            if (updatedTask[0].ativo) {
                scheduleTaskInstance(updatedTask[0]);
            } else {
                stopTaskInstance(parseInt(id));
            }
        }

        res.json({ message: `Tarefa ${ativo ? 'ativada' : 'desativada'} com sucesso.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/hermes/tasks/:id
router.delete('/tasks/:id', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        const { id } = req.params;

        stopTaskInstance(parseInt(id));
        await mysqlPool.query('DELETE FROM hermes_tasks WHERE id = ?', [id]);

        res.json({ message: 'Tarefa excluída com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/hermes/tasks/:id/execute
router.post('/tasks/:id/execute', async (req, res) => {
    try {
        if (!req.user || req.user.tipo !== 'SA') {
            return res.status(403).json({ error: 'Acesso restrito para Super Administradores.' });
        }
        const { id } = req.params;

        const [rows] = await mysqlPool.query('SELECT * FROM hermes_tasks WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        }

        const io = req.app.get('io');
        executeTaskImmediately(rows[0], io).catch(err => {
            console.error(`[HermesRouter] Erro na execução assíncrona imediata da tarefa ${id}:`, err.message);
        });

        res.json({ message: 'Execução da tarefa iniciada em segundo plano.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
