const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

// Middleware de isolamento multi-tenant
router.use(tenantMiddleware);

const getTenantId = (req) => req.tenantId || req.user?.IdEmpresa || 1;

// ── INICIALIZAÇÃO DE TABELAS E SEED AUTOMÁTICO MULTI-EMPRESA ────────

let tablesInitialized = false;

async function ensureTablesAndSeed(tenantId) {
    if (tablesInitialized) {
        // Garantir seed para este tenant específico se estiver vazio
        await seedTenantDefaultsIfEmpty(tenantId);
        return;
    }

    try {
        // 1. Tabela de Prefixos / Famílias de Produtos
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_cad_prefixos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                IdEmpresa INT NOT NULL DEFAULT 1,
                sigla VARCHAR(15) NOT NULL,
                descricao VARCHAR(150) NOT NULL,
                padrao_sequencial VARCHAR(20) DEFAULT '0001',
                rapido TINYINT(1) DEFAULT 1,
                ativo TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_prefixo_emp (IdEmpresa, sigla),
                INDEX idx_prefixo_emp (IdEmpresa),
                INDEX idx_prefixo_ativo (ativo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 2. Tabela de Tipos de Produtos (B1_TIPO)
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_cad_tipos_produto (
                id INT AUTO_INCREMENT PRIMARY KEY,
                IdEmpresa INT NOT NULL DEFAULT 1,
                codigo VARCHAR(10) NOT NULL,
                descricao VARCHAR(150) NOT NULL,
                ativo TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_tipo_emp (IdEmpresa, codigo),
                INDEX idx_tipo_emp (IdEmpresa),
                INDEX idx_tipo_ativo (ativo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 3. Tabela de Unidades de Medida (B1_UM)
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_cad_unidades_medida (
                id INT AUTO_INCREMENT PRIMARY KEY,
                IdEmpresa INT NOT NULL DEFAULT 1,
                codigo VARCHAR(10) NOT NULL,
                descricao VARCHAR(150) NOT NULL,
                ativo TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_um_emp (IdEmpresa, codigo),
                INDEX idx_um_emp (IdEmpresa),
                INDEX idx_um_ativo (ativo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 4. Tabela de Armazéns / Locais de Estoque (B1_LOCPAD)
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_cad_armazens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                IdEmpresa INT NOT NULL DEFAULT 1,
                codigo VARCHAR(10) NOT NULL,
                descricao VARCHAR(150) NOT NULL,
                ativo TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_armazem_emp (IdEmpresa, codigo),
                INDEX idx_armazem_emp (IdEmpresa),
                INDEX idx_armazem_ativo (ativo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        tablesInitialized = true;
        await seedTenantDefaultsIfEmpty(tenantId);
    } catch (err) {
        console.error('⚠️ [CADASTROS BÁSICOS] Erro ao inicializar tabelas:', err.message);
    }
}

// Preenche dados padrão da filosofia Protheus caso o tenant ainda não tenha registros
async function seedTenantDefaultsIfEmpty(tenantId) {
    try {
        // 1. Prefixos Padrão
        const [prefRows] = await db.query('SELECT COUNT(*) as count FROM app_cad_prefixos WHERE IdEmpresa = ?', [tenantId]);
        if (prefRows[0].count === 0) {
            const defaultPrefixos = [
                ['MT2', 'Componentes / Cabines (MT2)', 1],
                ['MT3', 'Conjuntos Soldados / Weldments (MT3)', 1],
                ['MT4', 'Perfis e Estruturas Maiores (MT4)', 1],
                ['MT5', 'Chaparias e Caldeiraria (MT5)', 1],
                ['MT6', 'Componentes Auxiliares (MT6)', 1],
                ['SCL', 'Produtos Acabados Gerais (SCL)', 1],
                ['MPT', 'Matérias-Primas Tratadas (MPT)', 1],
                ['MTA', 'Acessórios e Montagens (MTA)', 1],
                ['MTF', 'Ferramentais e Fixadores (MTF)', 1],
                ['SEG', 'Itens de Segurança (SEG)', 0],
                ['DIV', 'Diversos (DIV)', 0],
                ['ESC', 'Escadas e Estruturas (ESC)', 0]
            ];
            for (const [sigla, desc, rapido] of defaultPrefixos) {
                await db.query(
                    `INSERT IGNORE INTO app_cad_prefixos (IdEmpresa, sigla, descricao, rapido, ativo) VALUES (?, ?, ?, ?, 1)`,
                    [tenantId, sigla, desc, rapido]
                );
            }
        }

        // 2. Tipos de Produto Padrão (B1_TIPO)
        const [tiposRows] = await db.query('SELECT COUNT(*) as count FROM app_cad_tipos_produto WHERE IdEmpresa = ?', [tenantId]);
        if (tiposRows[0].count === 0) {
            const defaultTipos = [
                ['PI', 'Produto Intermediário'],
                ['PA', 'Produto Acabado'],
                ['MP', 'Matéria-Prima'],
                ['MC', 'Material de Consumo'],
                ['SL', 'Subconjunto'],
                ['SV', 'Serviço'],
                ['EM', 'Embalagem'],
                ['ME', 'Revenda']
            ];
            for (const [codigo, desc] of defaultTipos) {
                await db.query(
                    `INSERT IGNORE INTO app_cad_tipos_produto (IdEmpresa, codigo, descricao, ativo) VALUES (?, ?, ?, 1)`,
                    [tenantId, codigo, desc]
                );
            }
        }

        // 3. Unidades de Medida Padrão (B1_UM)
        const [umRows] = await db.query('SELECT COUNT(*) as count FROM app_cad_unidades_medida WHERE IdEmpresa = ?', [tenantId]);
        if (umRows[0].count === 0) {
            const defaultUM = [
                ['UN', 'Unidade'],
                ['PC', 'Peça'],
                ['KG', 'Quilograma'],
                ['MT', 'Metro'],
                ['M2', 'Metro Quadrado'],
                ['M3', 'Metro Cúbico'],
                ['L', 'Litro'],
                ['CX', 'Caixa'],
                ['PR', 'Par']
            ];
            for (const [codigo, desc] of defaultUM) {
                await db.query(
                    `INSERT IGNORE INTO app_cad_unidades_medida (IdEmpresa, codigo, descricao, ativo) VALUES (?, ?, ?, 1)`,
                    [tenantId, codigo, desc]
                );
            }
        }

        // 4. Armazéns Padrão (B1_LOCPAD)
        const [armRows] = await db.query('SELECT COUNT(*) as count FROM app_cad_armazens WHERE IdEmpresa = ?', [tenantId]);
        if (armRows[0].count === 0) {
            const defaultArmazens = [
                ['01', 'Almoxarifado Central'],
                ['02', 'Matéria-Prima'],
                ['03', 'Expedição'],
                ['99', 'Chão de Fábrica / Linha']
            ];
            for (const [codigo, desc] of defaultArmazens) {
                await db.query(
                    `INSERT IGNORE INTO app_cad_armazens (IdEmpresa, codigo, descricao, ativo) VALUES (?, ?, ?, 1)`,
                    [tenantId, codigo, desc]
                );
            }
        }

        // 5. Cores de Aço Padrão (SAE 1020, 1045, 4140, 8620, INOX, etc.)
        try {
            const { seedSteelColors } = require('../services/tenantSeedService');
            await seedSteelColors(tenantId, false);
        } catch (colorErr) {
            console.warn('⚠️ [CADASTROS BÁSICOS] Aviso no seed de cores de aço:', colorErr.message);
        }
    } catch (seedErr) {
        console.warn('⚠️ [CADASTROS BÁSICOS] Aviso no seed:', seedErr.message);
    }
}


// ── IN-MEMORY CACHE PARA CADASTROS BÁSICOS (TTL: 5 MINUTOS) ─────────
const cadastrosCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function invalidateCadastrosCache(tenantId) {
    if (tenantId) {
        cadastrosCache.delete(`todos_${tenantId}_true`);
        cadastrosCache.delete(`todos_${tenantId}_false`);
    } else {
        cadastrosCache.clear();
    }
}

// Invalida cache automaticamente em qualquer escrita (POST, PUT, DELETE, PATCH)
router.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                invalidateCadastrosCache(getTenantId(req));
            }
        });
    }
    next();
});

// ── ENDPOINT UNIFICADO: BUSCA TODOS OS CADASTROS BÁSICOS (PARA SELECTS) ──

router.get('/todos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const apenasAtivos = req.query.apenas_ativos === '1' || req.query.ativos === 'true';
        const cacheKey = `todos_${tenantId}_${apenasAtivos}`;
        const cached = cadastrosCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return res.json(cached.data);
        }

        await ensureTablesAndSeed(tenantId);
        const whereClause = apenasAtivos ? 'AND ativo = 1' : '';

        const [prefixos] = await db.query(
            `SELECT * FROM app_cad_prefixos WHERE IdEmpresa = ? ${whereClause} ORDER BY rapido DESC, sigla ASC`,
            [tenantId]
        );
        const [tipos] = await db.query(
            `SELECT * FROM app_cad_tipos_produto WHERE IdEmpresa = ? ${whereClause} ORDER BY codigo ASC`,
            [tenantId]
        );
        const [unidades] = await db.query(
            `SELECT * FROM app_cad_unidades_medida WHERE IdEmpresa = ? ${whereClause} ORDER BY codigo ASC`,
            [tenantId]
        );
        const [armazens] = await db.query(
            `SELECT * FROM app_cad_armazens WHERE IdEmpresa = ? ${whereClause} ORDER BY codigo ASC`,
            [tenantId]
        );

        const responseData = {
            prefixos,
            tipos,
            unidades,
            armazens
        };

        cadastrosCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
        res.json(responseData);
    } catch (err) {
        console.error('Erro ao buscar cadastros básicos unificados:', err);
        res.status(500).json({ error: 'Erro ao carregar cadastros básicos.' });
    }
});


// ── 1. CRUD DE PREFIXOS (FAMÍLIAS / B1_COD) ──────────────────────

router.get('/prefixos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTablesAndSeed(tenantId);

        const [rows] = await db.query(
            `SELECT * FROM app_cad_prefixos WHERE IdEmpresa = ? ORDER BY rapido DESC, sigla ASC`,
            [tenantId]
        );
        res.json({ prefixos: rows });
    } catch (err) {
        console.error('Erro ao listar prefixos:', err);
        res.status(500).json({ error: 'Erro ao carregar prefixos.' });
    }
});

router.post('/prefixos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTablesAndSeed(tenantId);
        const { sigla, descricao, padrao_sequencial, rapido } = req.body;

        if (!sigla || !sigla.trim()) {
            return res.status(400).json({ error: 'A sigla do prefixo é obrigatória (ex: MT2, GAB).' });
        }

        const cleanSigla = sigla.trim().toUpperCase();

        const [result] = await db.query(
            `INSERT INTO app_cad_prefixos (IdEmpresa, sigla, descricao, padrao_sequencial, rapido, ativo)
             VALUES (?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE descricao = VALUES(descricao), padrao_sequencial = VALUES(padrao_sequencial), rapido = VALUES(rapido), ativo = 1`,
            [tenantId, cleanSigla, descricao?.trim() || cleanSigla, padrao_sequencial || '0001', rapido ? 1 : 0]
        );

        res.json({ id: result.insertId, message: 'Prefixo cadastrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao cadastrar prefixo:', err);
        res.status(500).json({ error: 'Erro ao salvar prefixo.' });
    }
});

router.put('/prefixos/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const { sigla, descricao, padrao_sequencial, rapido, ativo } = req.body;

        await db.query(
            `UPDATE app_cad_prefixos SET
                sigla = ?, descricao = ?, padrao_sequencial = ?, rapido = ?, ativo = ?
             WHERE id = ? AND IdEmpresa = ?`,
            [
                sigla.trim().toUpperCase(),
                descricao?.trim() || sigla.trim().toUpperCase(),
                padrao_sequencial || '0001',
                rapido ? 1 : 0,
                ativo !== undefined ? (ativo ? 1 : 0) : 1,
                id, tenantId
            ]
        );

        res.json({ message: 'Prefixo atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar prefixo:', err);
        res.status(500).json({ error: 'Erro ao atualizar prefixo.' });
    }
});

router.delete('/prefixos/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        const [result] = await db.query(
            `DELETE FROM app_cad_prefixos WHERE (id = ? OR sigla = ?) AND IdEmpresa = ?`,
            [id, id, tenantId]
        );

        res.json({ success: true, message: 'Prefixo removido com sucesso!', affectedRows: result.affectedRows });
    } catch (err) {
        console.error('Erro ao deletar prefixo:', err);
        res.status(500).json({ error: 'Erro ao remover prefixo.' });
    }
});


// ── 2. CRUD DE TIPOS DE PRODUTO (B1_TIPO) ────────────────────────

router.get('/tipos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTablesAndSeed(tenantId);

        const [rows] = await db.query(
            `SELECT * FROM app_cad_tipos_produto WHERE IdEmpresa = ? ORDER BY codigo ASC`,
            [tenantId]
        );
        res.json({ tipos: rows });
    } catch (err) {
        console.error('Erro ao listar tipos:', err);
        res.status(500).json({ error: 'Erro ao carregar tipos de produto.' });
    }
});

router.post('/tipos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTablesAndSeed(tenantId);
        const { codigo, descricao } = req.body;

        if (!codigo || !codigo.trim()) {
            return res.status(400).json({ error: 'O código do tipo é obrigatório (ex: PA, MP, PI).' });
        }

        const cleanCod = codigo.trim().toUpperCase();

        const [result] = await db.query(
            `INSERT INTO app_cad_tipos_produto (IdEmpresa, codigo, descricao, ativo)
             VALUES (?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE descricao = VALUES(descricao), ativo = 1`,
            [tenantId, cleanCod, descricao?.trim() || cleanCod]
        );

        res.json({ id: result.insertId, message: 'Tipo cadastrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao cadastrar tipo:', err);
        res.status(500).json({ error: 'Erro ao salvar tipo.' });
    }
});

router.put('/tipos/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const { codigo, descricao, ativo } = req.body;

        await db.query(
            `UPDATE app_cad_tipos_produto SET
                codigo = ?, descricao = ?, ativo = ?
             WHERE id = ? AND IdEmpresa = ?`,
            [
                codigo.trim().toUpperCase(),
                descricao?.trim() || codigo.trim().toUpperCase(),
                ativo !== undefined ? (ativo ? 1 : 0) : 1,
                id, tenantId
            ]
        );

        res.json({ message: 'Tipo atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar tipo:', err);
        res.status(500).json({ error: 'Erro ao atualizar tipo.' });
    }
});

router.delete('/tipos/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        const [result] = await db.query(
            `DELETE FROM app_cad_tipos_produto WHERE (id = ? OR codigo = ?) AND IdEmpresa = ?`,
            [id, id, tenantId]
        );

        res.json({ success: true, message: 'Tipo removido com sucesso!', affectedRows: result.affectedRows });
    } catch (err) {
        console.error('Erro ao deletar tipo:', err);
        res.status(500).json({ error: 'Erro ao remover tipo.' });
    }
});


// ── 3. CRUD DE UNIDADES DE MEDIDA (B1_UM) ────────────────────────

router.get('/unidades', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTablesAndSeed(tenantId);

        const [rows] = await db.query(
            `SELECT * FROM app_cad_unidades_medida WHERE IdEmpresa = ? ORDER BY codigo ASC`,
            [tenantId]
        );
        res.json({ unidades: rows });
    } catch (err) {
        console.error('Erro ao listar unidades:', err);
        res.status(500).json({ error: 'Erro ao carregar unidades de medida.' });
    }
});

router.post('/unidades', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTablesAndSeed(tenantId);
        const { codigo, descricao } = req.body;

        if (!codigo || !codigo.trim()) {
            return res.status(400).json({ error: 'O código da unidade é obrigatório (ex: UN, PC, KG).' });
        }

        const cleanCod = codigo.trim().toUpperCase();

        const [result] = await db.query(
            `INSERT INTO app_cad_unidades_medida (IdEmpresa, codigo, descricao, ativo)
             VALUES (?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE descricao = VALUES(descricao), ativo = 1`,
            [tenantId, cleanCod, descricao?.trim() || cleanCod]
        );

        res.json({ id: result.insertId, message: 'Unidade de medida cadastrada com sucesso!' });
    } catch (err) {
        console.error('Erro ao cadastrar unidade:', err);
        res.status(500).json({ error: 'Erro ao salvar unidade.' });
    }
});

router.put('/unidades/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const { codigo, descricao, ativo } = req.body;

        await db.query(
            `UPDATE app_cad_unidades_medida SET
                codigo = ?, descricao = ?, ativo = ?
             WHERE id = ? AND IdEmpresa = ?`,
            [
                codigo.trim().toUpperCase(),
                descricao?.trim() || codigo.trim().toUpperCase(),
                ativo !== undefined ? (ativo ? 1 : 0) : 1,
                id, tenantId
            ]
        );

        res.json({ message: 'Unidade atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar unidade:', err);
        res.status(500).json({ error: 'Erro ao atualizar unidade.' });
    }
});

router.delete('/unidades/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        const [result] = await db.query(
            `DELETE FROM app_cad_unidades_medida WHERE (id = ? OR codigo = ?) AND IdEmpresa = ?`,
            [id, id, tenantId]
        );

        res.json({ success: true, message: 'Unidade removida com sucesso!', affectedRows: result.affectedRows });
    } catch (err) {
        console.error('Erro ao deletar unidade:', err);
        res.status(500).json({ error: 'Erro ao remover unidade.' });
    }
});


// ── 4. CRUD DE ARMAZÉNS / LOCAIS DE ESTOQUE (B1_LOCPAD) ──────────

router.get('/armazens', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTablesAndSeed(tenantId);

        const [rows] = await db.query(
            `SELECT * FROM app_cad_armazens WHERE IdEmpresa = ? ORDER BY codigo ASC`,
            [tenantId]
        );
        res.json({ armazens: rows });
    } catch (err) {
        console.error('Erro ao listar armazéns:', err);
        res.status(500).json({ error: 'Erro ao carregar armazéns.' });
    }
});

router.post('/armazens', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        await ensureTablesAndSeed(tenantId);
        const { codigo, descricao } = req.body;

        if (!codigo || !codigo.trim()) {
            return res.status(400).json({ error: 'O código do armazém é obrigatório (ex: 01, 02, 99).' });
        }

        const cleanCod = codigo.trim().padStart(2, '0');

        const [result] = await db.query(
            `INSERT INTO app_cad_armazens (IdEmpresa, codigo, descricao, ativo)
             VALUES (?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE descricao = VALUES(descricao), ativo = 1`,
            [tenantId, cleanCod, descricao?.trim() || cleanCod]
        );

        res.json({ id: result.insertId, message: 'Armazém cadastrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao cadastrar armazém:', err);
        res.status(500).json({ error: 'Erro ao salvar armazém.' });
    }
});

router.put('/armazens/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const { codigo, descricao, ativo } = req.body;

        await db.query(
            `UPDATE app_cad_armazens SET
                codigo = ?, descricao = ?, ativo = ?
             WHERE id = ? AND IdEmpresa = ?`,
            [
                codigo.trim().padStart(2, '0'),
                descricao?.trim() || codigo.trim(),
                ativo !== undefined ? (ativo ? 1 : 0) : 1,
                id, tenantId
            ]
        );

        res.json({ message: 'Armazém atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar armazém:', err);
        res.status(500).json({ error: 'Erro ao atualizar armazém.' });
    }
});

router.delete('/armazens/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        const [result] = await db.query(
            `DELETE FROM app_cad_armazens WHERE (id = ? OR codigo = ?) AND IdEmpresa = ?`,
            [id, id, tenantId]
        );

        res.json({ success: true, message: 'Armazém removido com sucesso!', affectedRows: result.affectedRows });
    } catch (err) {
        console.error('Erro ao deletar armazém:', err);
        res.status(500).json({ error: 'Erro ao remover armazém.' });
    }
});

// ── RESTAURAR PADRÕES DO PROTHEUS (RESET / SEED FORÇADO) ─────────

router.post('/restaurar-padroes', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        tablesInitialized = false;
        await seedTenantDefaultsIfEmpty(tenantId);
        const { seedSteelColors } = require('../services/tenantSeedService');
        await seedSteelColors(tenantId, true);
        res.json({ message: 'Cadastros básicos e padrão de cores de aço restaurados com sucesso!' });
    } catch (err) {
        console.error('Erro ao restaurar padrões:', err);
        res.status(500).json({ error: 'Erro ao restaurar padrões.' });
    }
});

// ── MATRIZ DE TEMPLATES DINÂMICOS DE PRODUTOS POR EMPRESA ────────

// Listar todos os templates da empresa com seus respectivos campos
router.get('/templates', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const [templates] = await db.query(
            `SELECT * FROM app_cad_produto_templates WHERE IdEmpresa = ? ORDER BY nome ASC`,
            [tenantId]
        );

        if (templates.length === 0) {
            return res.json({ templates: [] });
        }

        const templateIds = templates.map(t => t.id);
        const [campos] = await db.query(
            `SELECT * FROM app_cad_produto_template_campos 
             WHERE template_id IN (?) 
             ORDER BY template_id, ordem ASC, id ASC`,
            [templateIds]
        );

        const camposPorTemplate = {};
        for (const c of campos) {
            if (!camposPorTemplate[c.template_id]) {
                camposPorTemplate[c.template_id] = [];
            }
            camposPorTemplate[c.template_id].push(c);
        }

        const resultado = templates.map(t => ({
            ...t,
            campos: camposPorTemplate[t.id] || []
        }));

        res.json({ templates: resultado });
    } catch (err) {
        console.error('Erro ao listar templates de produtos:', err);
        res.status(500).json({ error: 'Erro ao listar modelos de formulários.' });
    }
});

// Buscar template específico ou o mais compatível por tipo/prefixo
router.get('/templates/match', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { tipo, prefixo, template_id } = req.query;

        let query = `SELECT * FROM app_cad_produto_templates WHERE IdEmpresa = ? AND ativo = 1`;
        const params = [tenantId];

        if (template_id) {
            query += ` AND id = ? LIMIT 1`;
            params.push(parseInt(template_id, 10));
        } else if (tipo) {
            query += ` AND tipo_produto = ? ORDER BY id ASC LIMIT 1`;
            params.push(tipo);
        } else {
            query += ` ORDER BY id ASC LIMIT 1`;
        }

        const [rows] = await db.query(query, params);
        if (rows.length === 0) {
            return res.json({ template: null, campos: [] });
        }

        const template = rows[0];
        const [campos] = await db.query(
            `SELECT * FROM app_cad_produto_template_campos WHERE template_id = ? ORDER BY ordem ASC, id ASC`,
            [template.id]
        );

        res.json({ template, campos });
    } catch (err) {
        console.error('Erro ao buscar template de produto:', err);
        res.status(500).json({ error: 'Erro ao buscar modelo compatível.' });
    }
});

// Criar novo template com seus campos
router.post('/templates', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { nome, tipo_produto, descricao_mascara, ativo = 1, campos = [] } = req.body;

        if (!nome || !tipo_produto) {
            return res.status(400).json({ error: 'Nome do modelo e tipo de produto são obrigatórios.' });
        }

        const [resTemplate] = await db.execute(
            `INSERT INTO app_cad_produto_templates (IdEmpresa, nome, tipo_produto, descricao_mascara, ativo)
             VALUES (?, ?, ?, ?, ?)`,
            [tenantId, nome.trim(), tipo_produto.trim().toUpperCase(), descricao_mascara?.trim() || null, ativo ? 1 : 0]
        );
        const newTemplateId = resTemplate.insertId;

        if (Array.isArray(campos) && campos.length > 0) {
            for (let i = 0; i < campos.length; i++) {
                const c = campos[i];
                await db.execute(
                    `INSERT INTO app_cad_produto_template_campos 
                     (template_id, campo_chave, campo_destino, label, tipo_input, opcoes_select, unidade, obrigatorio, ordem)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        newTemplateId,
                        c.campo_chave?.trim() || `campo_${i + 1}`,
                        c.campo_destino?.trim() || 'atributos_json',
                        c.label?.trim() || 'Campo',
                        c.tipo_input || 'text',
                        c.opcoes_select || null,
                        c.unidade || null,
                        c.obrigatorio ? 1 : 0,
                        c.ordem !== undefined ? parseInt(c.ordem, 10) : i + 1
                    ]
                );
            }
        }

        res.status(201).json({ success: true, id: newTemplateId, message: 'Modelo criado com sucesso!' });
    } catch (err) {
        console.error('Erro ao criar template de produto:', err);
        res.status(500).json({ error: 'Erro ao salvar novo modelo de produto.' });
    }
});

// Atualizar template existente e seus campos
router.put('/templates/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const { nome, tipo_produto, descricao_mascara, ativo = 1, campos = [] } = req.body;

        await db.execute(
            `UPDATE app_cad_produto_templates SET
                nome = ?, tipo_produto = ?, descricao_mascara = ?, ativo = ?
             WHERE id = ? AND IdEmpresa = ?`,
            [nome.trim(), tipo_produto.trim().toUpperCase(), descricao_mascara?.trim() || null, ativo ? 1 : 0, id, tenantId]
        );

        // Substituir campos
        await db.execute(`DELETE FROM app_cad_produto_template_campos WHERE template_id = ?`, [id]);

        if (Array.isArray(campos) && campos.length > 0) {
            for (let i = 0; i < campos.length; i++) {
                const c = campos[i];
                await db.execute(
                    `INSERT INTO app_cad_produto_template_campos 
                     (template_id, campo_chave, campo_destino, label, tipo_input, opcoes_select, unidade, obrigatorio, ordem)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        c.campo_chave?.trim() || `campo_${i + 1}`,
                        c.campo_destino?.trim() || 'atributos_json',
                        c.label?.trim() || 'Campo',
                        c.tipo_input || 'text',
                        c.opcoes_select || null,
                        c.unidade || null,
                        c.obrigatorio ? 1 : 0,
                        c.ordem !== undefined ? parseInt(c.ordem, 10) : i + 1
                    ]
                );
            }
        }

        res.json({ success: true, message: 'Modelo atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar template de produto:', err);
        res.status(500).json({ error: 'Erro ao atualizar modelo de produto.' });
    }
});

// Excluir template
router.delete('/templates/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        await db.execute(`DELETE FROM app_cad_produto_template_campos WHERE template_id = ?`, [id]);
        await db.execute(`DELETE FROM app_cad_produto_templates WHERE id = ? AND IdEmpresa = ?`, [id, tenantId]);

        res.json({ success: true, message: 'Modelo removido com sucesso!' });
    } catch (err) {
        console.error('Erro ao excluir template:', err);
        res.status(500).json({ error: 'Erro ao remover modelo.' });
    }
});

// Obter atributos preenchidos de um produto específico
router.get('/produtos/:codigo/atributos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { codigo } = req.params;

        const [rows] = await db.query(
            `SELECT * FROM app_cad_produto_atributos WHERE produto_codigo = ? AND IdEmpresa = ? LIMIT 1`,
            [codigo.trim(), tenantId]
        );

        if (rows.length === 0) {
            return res.json({ atributos: {}, template_id: null });
        }

        let atributosObj = {};
        try {
            atributosObj = typeof rows[0].atributos_json === 'string' 
                ? JSON.parse(rows[0].atributos_json || '{}') 
                : (rows[0].atributos_json || {});
        } catch (e) {
            atributosObj = {};
        }

        res.json({
            atributos: atributosObj,
            template_id: rows[0].template_id
        });
    } catch (err) {
        console.error('Erro ao buscar atributos do produto:', err);
        res.status(500).json({ error: 'Erro ao obter atributos do produto.' });
    }
});

// Salvar atributos preenchidos de um produto
router.post('/produtos/:codigo/atributos', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { codigo } = req.params;
        const { template_id, atributos } = req.body;

        const atributosJsonStr = JSON.stringify(atributos || {});

        await db.execute(
            `INSERT INTO app_cad_produto_atributos (IdEmpresa, produto_codigo, template_id, atributos_json)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                template_id = VALUES(template_id),
                atributos_json = VALUES(atributos_json),
                updated_at = CURRENT_TIMESTAMP`,
            [tenantId, codigo.trim(), template_id || null, atributosJsonStr]
        );

        res.json({ success: true, message: 'Atributos específicos salvos com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar atributos do produto:', err);
        res.status(500).json({ error: 'Erro ao salvar atributos específicos.' });
    }
});

module.exports = router;

