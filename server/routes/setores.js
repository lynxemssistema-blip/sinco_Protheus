const express = require('express');
const router = express.Router();
const mysql = require('../services/mysqlService');
const db = require('../db'); // Protheus (PostgreSQL)
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');

// ─── Ensure Tables (MySQL) ────────────────────────────────────────────────────
async function ensureTables() {
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS pcp_setores (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            nome        VARCHAR(100) NOT NULL,
            descricao   TEXT,
            cor         VARCHAR(20) DEFAULT '#3b82f6',
            ativo       TINYINT(1) DEFAULT 1,
            ordem       INT DEFAULT 0,
            criado_em   DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // Safety fallback to add column if table already exists
    try {
        await mysql.query('ALTER TABLE pcp_setores ADD COLUMN ordem INT DEFAULT 0');
    } catch (e) {
        // Ignore if column already exists
    }

    await mysql.query(`
        CREATE TABLE IF NOT EXISTS pcp_setor_recursos (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            setor_id        INT NOT NULL,
            recurso_codigo  VARCHAR(20) NOT NULL,
            recurso_nome    VARCHAR(200),
            criado_em       DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_recurso (recurso_codigo),
            FOREIGN KEY (setor_id) REFERENCES pcp_setores(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await mysql.query(`
        CREATE TABLE IF NOT EXISTS pcp_setor_responsaveis (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setor_id INT NOT NULL,
            usuario_id INT NOT NULL,
            envia_email TINYINT(1) DEFAULT 1,
            envia_whatsapp TINYINT(1) DEFAULT 0,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_setor_usuario (setor_id, usuario_id),
            FOREIGN KEY (setor_id) REFERENCES pcp_setores(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    try {
        await mysql.query('ALTER TABLE pcp_setor_responsaveis ADD COLUMN envia_email TINYINT(1) DEFAULT 1');
        await mysql.query('ALTER TABLE pcp_setor_responsaveis ADD COLUMN envia_whatsapp TINYINT(1) DEFAULT 0');
    } catch (e) {}
}

ensureTables().catch(err => console.error('[setores] Erro ao criar tabelas:', err.message));

// ─── GET /api/pcp-setores ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const [rows] = await mysql.query(`
            SELECT s.*,
                   COUNT(DISTINCT r.id) AS qtd_recursos,
                   COUNT(DISTINCT resp.id) AS qtd_responsaveis
            FROM pcp_setores s
            LEFT JOIN pcp_setor_recursos r ON r.setor_id = s.id
            LEFT JOIN pcp_setor_responsaveis resp ON resp.setor_id = s.id
            GROUP BY s.id
            ORDER BY s.ordem ASC, s.nome ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('[setores] GET /:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/pcp-setores ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const { nome, descricao, cor } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome e obrigatorio.' });
    try {
        const [maxRow] = await mysql.query('SELECT MAX(ordem) as maxOrdem FROM pcp_setores');
        const nextOrdem = (maxRow[0].maxOrdem || 0) + 1;
        
        const [result] = await mysql.query(
            `INSERT INTO pcp_setores (nome, descricao, cor, ordem) VALUES (?, ?, ?, ?)`,
            [nome.trim(), descricao || null, cor || '#3b82f6', nextOrdem]
        );
        const [rows] = await mysql.query(`SELECT * FROM pcp_setores WHERE id = ?`, [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[setores] POST /:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/pcp-setores/reorder ────────────────────────────────────────────
router.post('/reorder', async (req, res) => {
    const { order } = req.body; // array of IDs
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Order deve ser um array de IDs.' });
    try {
        const connection = await mysql.getConnection();
        await connection.beginTransaction();
        try {
            for (let i = 0; i < order.length; i++) {
                await connection.query('UPDATE pcp_setores SET ordem = ? WHERE id = ?', [i, order[i]]);
            }
            await connection.commit();
            res.json({ ok: true });
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('[setores] POST /reorder:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/pcp-setores/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    const { nome, descricao, cor } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome e obrigatorio.' });
    try {
        await mysql.query(
            `UPDATE pcp_setores SET nome=?, descricao=?, cor=? WHERE id=?`,
            [nome.trim(), descricao || null, cor || '#3b82f6', req.params.id]
        );
        const [rows] = await mysql.query(`SELECT * FROM pcp_setores WHERE id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Setor nao encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[setores] PUT /:id:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── PATCH /api/pcp-setores/:id/toggle ───────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
    try {
        await mysql.query(
            `UPDATE pcp_setores SET ativo = NOT ativo WHERE id=?`,
            [req.params.id]
        );
        const [rows] = await mysql.query(`SELECT * FROM pcp_setores WHERE id = ?`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Setor nao encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[setores] PATCH /:id/toggle:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/pcp-setores/:id ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const [[check]] = await mysql.query(
            `SELECT COUNT(*) AS total FROM pcp_setor_recursos WHERE setor_id=?`,
            [req.params.id]
        );
        if (check.total > 0) {
            return res.status(400).json({ error: 'Remova os recursos vinculados antes de excluir o setor.' });
        }
        await mysql.query(`DELETE FROM pcp_setores WHERE id=?`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        console.error('[setores] DELETE /:id:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/pcp-setores/recursos/:setorId ───────────────────────────────────
router.get('/recursos/:setorId', async (req, res) => {
    try {
        const [rows] = await mysql.query(
            `SELECT * FROM pcp_setor_recursos WHERE setor_id=? ORDER BY recurso_codigo`,
            [req.params.setorId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[setores] GET /recursos/:setorId:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/pcp-setores/protheus-recursos ───────────────────────────────────
router.get('/protheus-recursos', async (req, res) => {
    const q = (req.query.q || '').trim();
    const like = `%${q.toUpperCase()}%`;
    try {
        const [vinc] = await mysql.query(`SELECT recurso_codigo FROM pcp_setor_recursos`);
        const jaVinculados = vinc.map(v => v.recurso_codigo.trim().toUpperCase());

        let queryStr = `
            SELECT DISTINCT
                    RTRIM(h1_codigo) AS codigo,
                    RTRIM(h1_descri)  AS nome
             FROM public.sh1010
             WHERE d_e_l_e_t_ = ' '
               AND (UPPER(RTRIM(h1_codigo)) LIKE $1 OR UPPER(RTRIM(h1_descri)) LIKE $1)
        `;
        const queryParams = [like];

        if (jaVinculados.length > 0) {
            queryStr += ` AND RTRIM(h1_codigo) NOT IN (${jaVinculados.map((_, i) => `$${i + 2}`).join(',')})`;
            queryParams.push(...jaVinculados);
        }

        queryStr += ` ORDER BY codigo LIMIT 50`;

        const result = await db.query(queryStr, queryParams);
        res.json(result.rows.map(r => ({ codigo: r.codigo, nome: r.nome || '' })));
    } catch (err) {
        console.error('[setores] GET /protheus-recursos:', err.message);
        res.json([]);
    }
});

// ─── GET /api/pcp-setores/todos-recursos ───────────────────────────────────
router.get('/todos-recursos', async (req, res) => {
    const q = (req.query.q || '').trim();
    const like = `%${q.toUpperCase()}%`;
    try {
        let queryStr = `
            SELECT DISTINCT
                    RTRIM(h1_codigo) AS codigo,
                    RTRIM(h1_descri)  AS nome
             FROM public.sh1010
             WHERE d_e_l_e_t_ = ' '
        `;
        const queryParams = [];

        if (q) {
            queryStr += ` AND (UPPER(RTRIM(h1_codigo)) LIKE $1 OR UPPER(RTRIM(h1_descri)) LIKE $1)`;
            queryParams.push(like);
        }

        queryStr += ` ORDER BY RTRIM(h1_codigo) LIMIT 100`;

        const result = await db.query(queryStr, queryParams);
        res.json(result.rows.map(r => ({ codigo: r.codigo, nome: r.nome || '' })));
    } catch (err) {
        console.error('[setores] GET /todos-recursos:', err.message);
        res.json([]);
    }
});

// ─── POST /api/pcp-setores/recursos ──────────────────────────────────────────
router.post('/recursos', async (req, res) => {
    const { setor_id, recurso_codigo, recurso_nome } = req.body;
    if (!setor_id || !recurso_codigo) {
        return res.status(400).json({ error: 'setor_id e recurso_codigo sao obrigatorios.' });
    }
    try {
        const [result] = await mysql.query(
            `INSERT IGNORE INTO pcp_setor_recursos (setor_id, recurso_codigo, recurso_nome)
             VALUES (?, ?, ?)`,
            [setor_id, recurso_codigo.trim().toUpperCase(), recurso_nome || recurso_codigo]
        );
        if (result.affectedRows === 0) {
            return res.status(409).json({ error: `Recurso ${recurso_codigo} ja esta vinculado a outro setor.` });
        }
        const [rows] = await mysql.query(`SELECT * FROM pcp_setor_recursos WHERE id=?`, [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[setores] POST /recursos:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/pcp-setores/recursos/:recursoId ─────────────────────────────
router.delete('/recursos/:recursoId', async (req, res) => {
    try {
        await mysql.query(`DELETE FROM pcp_setor_recursos WHERE id=?`, [req.params.recursoId]);
        res.json({ ok: true });
    } catch (err) {
        console.error('[setores] DELETE /recursos/:recursoId:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── RESPONSÁVEIS DO SETOR ────────────────────────────────────────────────────

router.get('/:setorId/responsaveis', async (req, res) => {
    try {
        const [rows] = await mysql.query(`
            SELECT r.id as vinculo_id, r.setor_id, r.usuario_id, r.envia_email, r.envia_whatsapp, u.NomeCompleto, u.email, u.telefone
            FROM pcp_setor_responsaveis r
            JOIN usuario u ON u.idUsuario = r.usuario_id
            WHERE r.setor_id = ?
            ORDER BY u.NomeCompleto ASC
        `, [req.params.setorId]);
        res.json(rows);
    } catch (err) {
        console.error('[setores] GET /:setorId/responsaveis:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/:setorId/responsaveis', async (req, res) => {
    const { usuario_id } = req.body;
    if (!usuario_id) return res.status(400).json({ error: 'usuario_id é obrigatório.' });

    try {
        // Valida se o usuário existe e se tem telefone e e-mail
        const [users] = await mysql.query('SELECT NomeCompleto, email, telefone FROM usuario WHERE idUsuario = ?', [usuario_id]);
        if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        
        const user = users[0];
        if (!user.email || !user.email.trim()) {
            return res.status(400).json({ error: `O usuário ${user.NomeCompleto} não possui E-mail cadastrado. Atualize o cadastro do usuário antes de vinculá-lo.` });
        }
        if (!user.telefone || !user.telefone.trim()) {
            return res.status(400).json({ error: `O usuário ${user.NomeCompleto} não possui Celular (telefone) cadastrado. Atualize o cadastro do usuário antes de vinculá-lo.` });
        }

        // Tenta vincular
        const [result] = await mysql.query(
            `INSERT IGNORE INTO pcp_setor_responsaveis (setor_id, usuario_id) VALUES (?, ?)`,
            [req.params.setorId, usuario_id]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({ error: 'Usuário já é responsável por este setor.' });
        }

        const [rows] = await mysql.query(`
            SELECT r.id as vinculo_id, r.setor_id, r.usuario_id, u.NomeCompleto, u.email, u.telefone
            FROM pcp_setor_responsaveis r
            JOIN usuario u ON u.idUsuario = r.usuario_id
            WHERE r.id = ?`, [result.insertId]);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[setores] POST /:setorId/responsaveis:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/responsaveis/:vinculoId', async (req, res) => {
    try {
        await mysql.query(`DELETE FROM pcp_setor_responsaveis WHERE id=?`, [req.params.vinculoId]);
        res.json({ ok: true });
    } catch (err) {
        console.error('[setores] DELETE /responsaveis/:vinculoId:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/responsaveis/:vinculoId/notify', async (req, res) => {
    const { envia_email, envia_whatsapp } = req.body;
    try {
        await mysql.query(
            `UPDATE pcp_setor_responsaveis SET envia_email=?, envia_whatsapp=? WHERE id=?`,
            [envia_email ? 1 : 0, envia_whatsapp ? 1 : 0, req.params.vinculoId]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error('[setores] PATCH /responsaveis/:vinculoId/notify:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Helper to populate Protheus metadata for OPs (Descriptions, Customers, Operations)
async function populateMetadata(initialRows) {
    const rowsWithMeta = [];
    if (initialRows.length === 0) return rowsWithMeta;

    // Fetch missing descriptions (sb1)
    const productCodes = [...new Set([
        ...initialRows.map(r => r.cod_produto_op_raw),
        ...initialRows.map(r => r.produto_pai_raw)
    ].filter(Boolean))];
    if (productCodes.length > 0) {
        const sb1Res = await db.query(`SELECT TRIM(b1_cod) as cod, RTRIM(b1_desc) as desc FROM sb1010 WHERE b1_cod = ANY($1) AND COALESCE(d_e_l_e_t_, ' ') = ' '`, [productCodes]);
        const productMap = {};
        sb1Res.rows.forEach(p => productMap[p.cod] = p.desc);
        initialRows.forEach(r => {
            r.desc_produto = productMap[r.cod_produto_op_raw] || '';
            if (r.produto_pai_raw) r.desc_produto_pai = productMap[r.produto_pai_raw] || '';
        });
    }

    // Fetch missing customer & delivery info (sc6 + sc5 + sa1)
    const pedidosRaw = [...new Set(initialRows.map(r => r.pedido_venda).filter(Boolean))];
    if (pedidosRaw.length > 0) {
        const sc6Res = await db.query(`
            SELECT TRIM(c6.c6_num) as ped, TRIM(c6.c6_item) as item_pv, RTRIM(c6.c6_pedcli) as ped_cliente, RTRIM(c6.c6_entreg) as prazo_entrega_pedido, RTRIM(sa1.a1_nome) as nome_cliente
            FROM sc6010 c6
            LEFT JOIN sc5010 sc5 ON sc5.c5_num = c6.c6_num AND COALESCE(sc5.d_e_l_e_t_, ' ') = ' '
            LEFT JOIN sa1010 sa1 ON sa1.a1_cod = sc5.c5_cliente AND sa1.a1_loja = sc5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, ' ') = ' '
            WHERE c6.c6_num = ANY($1) AND COALESCE(c6.d_e_l_e_t_, ' ') = ' '
        `, [pedidosRaw]);
        
        const pedInfoMap = {};
        sc6Res.rows.forEach(p => pedInfoMap[`${p.ped}|${p.item_pv}`] = p);
        
        initialRows.forEach(r => {
            const info = pedInfoMap[`${r.pedido_venda}|${r.item_pv}`];
            if (info) {
                r.ped_cliente = info.ped_cliente;
                r.prazo_entrega_pedido = info.prazo_entrega_pedido;
                r.nome_cliente = info.nome_cliente;
            }
        });
    }

    // Filtrar OPs que, mesmo com pedido, não retornaram cliente válido (ou seja, sem cliente associado)
    const validRows = initialRows.filter(r => r.nome_cliente && r.nome_cliente.trim() !== '');

    const uniqueProducts = [...new Set(validRows.map(r => r.cod_produto_op_raw).filter(Boolean))];
    let sg2Map = {};
    
    if (uniqueProducts.length > 0) {
        // Chunk sg2010 queries
        const chunkSize = 1000;
        for (let i = 0; i < uniqueProducts.length; i += chunkSize) {
            const chunk = uniqueProducts.slice(i, i + chunkSize);
            const sg2Result = await db.query(`
                SELECT 
                    TRIM(g2.g2_produto) as cod_produto_op_raw,
                    RTRIM(g2.g2_recurso) as recurso,
                    RTRIM(g2.g2_descri)  as desc_operacao,
                    RTRIM(h1.h1_descri)  as desc_recurso,
                    RTRIM(g2.g2_operac)  as operacao
                FROM sg2010 g2
                LEFT JOIN sh1010 h1 ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, ' ') = ' '
                WHERE g2.g2_produto = ANY($1)
                  AND COALESCE(g2.d_e_l_e_t_, ' ') = ' '
            `, [chunk]);

            sg2Result.rows.forEach(r => {
                if (!sg2Map[r.cod_produto_op_raw]) sg2Map[r.cod_produto_op_raw] = [];
                sg2Map[r.cod_produto_op_raw].push(r);
            });
        }
    }

    for (const op of validRows) {
        const operations = sg2Map[op.cod_produto_op_raw];
        if (operations && operations.length > 0) {
            for (const oper of operations) {
                rowsWithMeta.push({ ...op, ...oper });
            }
        } else {
            rowsWithMeta.push({ ...op, recurso: null, desc_operacao: null, operacao: null });
        }
    }
    return rowsWithMeta;
}

// ─── GET /api/pcp-setores/visao ───────────────────────────────────────────────
// Evolução de produção por setor: OPs x Setores
// - Estrutura (roteiro) vem do Protheus: SC2 + SG2
// - Apontamentos vem do MySQL: app_production_appointments
// - NÃO usa SH6 (Protheus) por incompatibilidade de schema
router.get('/visao', async (req, res) => {
    let { pedido, cliente, produto, data_inicio, data_fim, status, apenas_pendentes, no_paginate } = req.query;
    if (Array.isArray(pedido)) pedido = pedido[0];
    if (Array.isArray(cliente)) cliente = cliente[0];
    if (Array.isArray(produto)) produto = produto[0];

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 30);
    const offset = (page - 1) * limit;

    try {
        // 1. Setores ativos e seus recursos (MySQL)
        const [setoresRows] = await mysql.query(`
            SELECT s.id, s.nome, s.cor,
                   GROUP_CONCAT(r.recurso_codigo) AS recursos_str
            FROM pcp_setores s
            LEFT JOIN pcp_setor_recursos r ON r.setor_id = s.id
            WHERE s.ativo = 1
            GROUP BY s.id
            ORDER BY s.ordem ASC, s.nome ASC
        `);
        const setores = setoresRows.map(s => ({
            ...s,
            recursos: s.recursos_str ? s.recursos_str.split(',') : []
        }));

        // 2. Todos os recursos vinculados (para o card "Setor Nao Definido")
        const [recursosVinc] = await mysql.query(`SELECT recurso_codigo FROM pcp_setor_recursos`);
        const recursosVinculados = recursosVinc.map(r => r.recurso_codigo);

        // 3. Filtros para o Protheus
        const conditions = ["COALESCE(pl.d_e_l_e_t_, ' ') = ' '"];
        const params = [];

        if (pedido) {
            const pedidosArr = pedido.split(',').map(p => p.trim()).filter(Boolean);
            if (pedidosArr.length > 0) {
                const orConditions = pedidosArr.map(p => {
                    params.push(`%${p}%`);
                    const paramIdx = params.length;
                    return `(pl.c2_pedido LIKE $${paramIdx} OR root_op.c2_pedido LIKE $${paramIdx} OR pl.c2_num LIKE $${paramIdx})`;
                });
                conditions.push(`(${orConditions.join(' OR ')})`);
            }
        }

        // Performance: Pre-query matching clients to avoid slow unindexed joins
        let matchingPedidos = null;
        if (cliente) {
            const clientRes = await db.query(`
                SELECT DISTINCT TRIM(c5.c5_num) AS c5_num
                FROM sc5010 c5
                JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, ' ') = ' '
                WHERE UPPER(sa1.a1_nome) LIKE $1
                  AND COALESCE(c5.d_e_l_e_t_, ' ') = ' '
            `, [`%${cliente.toUpperCase()}%`]);
            matchingPedidos = clientRes.rows.map(r => r.c5_num).filter(Boolean);
            if (matchingPedidos.length === 0) {
                return res.json(no_paginate === 'true' ? [] : { data: [], meta: { total: 0, page, limit, totalPages: 0 } });
            }
        }

        if (matchingPedidos) {
            params.push(matchingPedidos);
            conditions.push(`(pl.c2_pedido = ANY($${params.length}) OR root_op.c2_pedido = ANY($${params.length}))`);
        }

        // Performance: Pre-query matching products to avoid slow unindexed joins
        let matchingProdutos = null;
        if (produto) {
            const prodRes = await db.query(`
                SELECT TRIM(b1_cod) AS b1_cod
                FROM sb1010
                WHERE (UPPER(b1_cod) LIKE $1 OR UPPER(b1_desc) LIKE $1)
                  AND COALESCE(d_e_l_e_t_, ' ') = ' '
            `, [`%${produto.toUpperCase()}%`]);
            matchingProdutos = prodRes.rows.map(r => r.b1_cod).filter(Boolean);
            if (matchingProdutos.length === 0) {
                return res.json(no_paginate === 'true' ? [] : { data: [], meta: { total: 0, page, limit, totalPages: 0 } });
            }
        }

        if (matchingProdutos) {
            params.push(matchingProdutos);
            conditions.push(`pl.c2_produto = ANY($${params.length})`);
        }

        if (data_inicio) {
            params.push(data_inicio.replace(/-/g, ''));
            conditions.push(`pl.c2_datpri >= $${params.length}`);
        }
        if (data_fim) {
            params.push(data_fim.replace(/-/g, ''));
            conditions.push(`pl.c2_datpri <= $${params.length}`);
        }
        if (apenas_pendentes === 'true') {
            conditions.push(`COALESCE(pl.c2_quant, 0) > COALESCE(pl.c2_quje, 0)`);
        }

        const getInactiveFilter = await getInactiveOrdersFilter();
        const inactiveSql = getInactiveFilter("COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), ''))");
        if (inactiveSql) conditions.push(inactiveSql.replace(/^\s*AND\s+/i, ''));

        // Desconsiderar OPs sem pedido (sem cliente associado)
        conditions.push(`TRIM(COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), ''))) <> ''`);

        let opsRows = [];
        let totalCount = 0;

        if (no_paginate === 'true') {
            const opsQuery = `
                SELECT
                    RTRIM(pl.c2_num)       AS op,
                    RTRIM(pl.c2_item)      AS item_op,
                    RTRIM(pl.c2_sequen)    AS sequen,
                    COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) AS pedido_venda,
                    COALESCE(NULLIF(TRIM(pl.c2_itempv), ''), NULLIF(TRIM(root_op.c2_itempv), '')) AS item_pv,
                    TRIM(pl.c2_produto)    AS cod_produto_op_raw,
                    RTRIM(pl.c2_produto)   AS cod_produto_op,
                    TRIM(COALESCE(root_op.c2_produto, pl.c2_produto)) AS produto_pai_raw,
                    RTRIM(COALESCE(root_op.c2_produto, pl.c2_produto)) AS produto_pai,
                    COALESCE(pl.c2_quant, 0) AS qtd_total,
                    COALESCE(pl.c2_quje, 0)  AS qtd_realizada_header
                FROM sc2010 pl
                LEFT JOIN sc2010 root_op ON root_op.c2_num = pl.c2_num AND root_op.c2_item = pl.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, ' ') = ' '
                WHERE ${conditions.join(' AND ')}
                ORDER BY pl.c2_datpri DESC
                LIMIT 4000
            `;
            const result = await db.query(opsQuery, params);
            opsRows = await populateMetadata(result.rows);
            totalCount = [...new Set(opsRows.map(r => r.pedido_venda))].length;
        } else {
            // Count total distinct pedidos
            const countQuery = `
                SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), ''))) AS total
                FROM sc2010 pl
                LEFT JOIN sc2010 root_op ON root_op.c2_num = pl.c2_num AND root_op.c2_item = pl.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, ' ') = ' '
                WHERE ${conditions.join(' AND ')}
            `;
            const countRes = await db.query(countQuery, params);
            totalCount = parseInt(countRes.rows[0]?.total) || 0;

            if (totalCount > 0) {
                // Paginate distinct pedidos
                const pedsQuery = `
                    SELECT 
                        COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) AS pedido_venda,
                        MAX(pl.c2_datpri) AS max_datpri
                    FROM sc2010 pl
                    LEFT JOIN sc2010 root_op ON root_op.c2_num = pl.c2_num AND root_op.c2_item = pl.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, ' ') = ' '
                    WHERE ${conditions.join(' AND ')}
                    GROUP BY COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), ''))
                    ORDER BY max_datpri DESC
                    LIMIT ${limit} OFFSET ${offset}
                `;
                const pedsRes = await db.query(pedsQuery, params);
                const paginatedPeds = pedsRes.rows.map(r => r.pedido_venda).filter(Boolean);

                if (paginatedPeds.length > 0) {
                    const detailParams = [...params, paginatedPeds];
                    const opsQuery = `
                        SELECT
                            RTRIM(pl.c2_num)       AS op,
                            RTRIM(pl.c2_item)      AS item_op,
                            RTRIM(pl.c2_sequen)    AS sequen,
                            COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) AS pedido_venda,
                            COALESCE(NULLIF(TRIM(pl.c2_itempv), ''), NULLIF(TRIM(root_op.c2_itempv), '')) AS item_pv,
                            TRIM(pl.c2_produto)    AS cod_produto_op_raw,
                            RTRIM(pl.c2_produto)   AS cod_produto_op,
                            TRIM(COALESCE(root_op.c2_produto, pl.c2_produto)) AS produto_pai_raw,
                            RTRIM(COALESCE(root_op.c2_produto, pl.c2_produto)) AS produto_pai,
                            COALESCE(pl.c2_quant, 0) AS qtd_total,
                            COALESCE(pl.c2_quje, 0)  AS qtd_realizada_header
                        FROM sc2010 pl
                        LEFT JOIN sc2010 root_op ON root_op.c2_num = pl.c2_num AND root_op.c2_item = pl.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, ' ') = ' '
                        WHERE ${conditions.join(' AND ')}
                          AND COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) = ANY($${detailParams.length})
                        ORDER BY pl.c2_datpri DESC
                    `;
                    const result = await db.query(opsQuery, detailParams);
                    opsRows = await populateMetadata(result.rows);
                }
            }
        }


        // 5. Apontamentos do MySQL — agrupados por op + item + sequencia + operacao
        const opNumbers = [...new Set(opsRows.map(r => r.op).filter(Boolean))];
        const apptsMap = {};

        if (opNumbers.length > 0) {
            const chunkSize = 1000; // MySQL IN clause limit safety
            for (let i = 0; i < opNumbers.length; i += chunkSize) {
                const chunk = opNumbers.slice(i, i + chunkSize);
                const placeholders = chunk.map(() => '?').join(',');
                const [mysqlRows] = await mysql.query(`
                    SELECT
                        op_numero,
                        op_item,
                        op_sequencia,
                        operacao_codigo,
                        SUM(quantidade) AS total_produzido
                    FROM app_production_appointments
                    WHERE op_numero IN (${placeholders})
                    GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
                `, chunk);

                for (const a of mysqlRows) {
                    const k = `${a.op_numero}|${a.op_item}|${a.op_sequencia}|${a.operacao_codigo}`;
                    apptsMap[k] = Number(a.total_produzido) || 0;
                }
            }
        }

        // 5.1. Busca de Romaneios em aberto (itens enviados sem retorno completo)
        const pvNumbers = [...new Set(opsRows.map(r => r.pedido_venda).filter(Boolean))];
        const opNumbersOnly = [...new Set(opsRows.map(r => r.op).filter(Boolean))];
        const romaneiosMap = {};

        const allSearchNumbers = [...new Set([...pvNumbers, ...opNumbersOnly])];
        if (allSearchNumbers.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < allSearchNumbers.length; i += chunkSize) {
                const chunk = allSearchNumbers.slice(i, i + chunkSize);
                const placeholders = chunk.map(() => '?').join(',');
                const [romRows] = await mysql.query(`
                    SELECT 
                        TRIM(i.pedido) AS pedido,
                        TRIM(i.item_pedido) AS item_pedido,
                        i.quantidade AS qtd_enviada,
                        (SELECT COALESCE(SUM(quantidade), 0) FROM app_romaneio_recebimentos WHERE romaneio_item_id = i.id) AS qtd_recebida,
                        r.id AS romaneio_id,
                        r.status AS romaneio_status
                    FROM app_romaneio_items i
                    JOIN app_romaneios r ON i.romaneio_id = r.id
                    WHERE r.status != 'Cancelado'
                      AND TRIM(i.pedido) IN (${placeholders})
                `, chunk);

                for (const r of romRows) {
                    const enviada = Number(r.qtd_enviada) || 0;
                    const recebida = Number(r.qtd_recebida) || 0;
                    if (recebida < enviada) {
                        const key = `${r.pedido}|${r.item_pedido}`;
                        if (!romaneiosMap[key]) {
                            romaneiosMap[key] = [];
                        }
                        romaneiosMap[key].push({
                            romaneio_id: r.romaneio_id,
                            status: r.romaneio_status,
                            saldo: enviada - recebida
                        });
                    }
                }
            }
        }

        // 6. Agrupa linhas do Protheus por recurso
        // Chave inclui sequen para garantir granularidade idêntica ao production.js
        // (cada sequência pode ter qtd diferente e apontamentos próprios)
        const opsPorRecurso = {};
        for (const row of opsRows) {
            const recurso = (row.recurso || '').trim();
            // Chave de grupo: op + item + SEQUÊNCIA (não apenas op+item)
            const key = `${row.op}|${row.item_op}|${row.sequen}`;
            // Chave de apontamento: mesma lógica do production.js
            const apptKey = `${row.op}|${row.item_op}|${row.sequen}|${row.operacao}`;
            const qtd_apontada = apptsMap[apptKey] || 0;

            const pvKey = `${(row.pedido_venda || '').trim()}|${(row.item_pv || '').trim()}`;
            const opKey = `${(row.op || '').trim()}|${(row.item_op || '').trim()}`;
            const romaneios = romaneiosMap[pvKey] || romaneiosMap[opKey] || null;

            if (!opsPorRecurso[recurso]) opsPorRecurso[recurso] = {};
            if (!opsPorRecurso[recurso][key]) {
                opsPorRecurso[recurso][key] = { ...row, operacoes: [], romaneios };
            }
            opsPorRecurso[recurso][key].operacoes.push({
                apptKey,                          // chave única para deduplicar depois
                operacao: row.operacao,
                desc_operacao: row.desc_operacao,
                produto_pai: row.produto_pai,
                desc_produto_pai: row.desc_produto_pai,
                qtd_op: Number(row.qtd_total) || 0,   // qtd desta sequência específica
                qtd_apontada
            });
        }

        // Helper: status da OP/sequência
        const hoje = new Date().toISOString().split('T')[0].replace(/-/g, '');
        function calcStatus(progresso, prazo) {
            if (progresso >= 100) return 'concluida';
            if (progresso > 0) {
                if (prazo && String(prazo).replace(/-/g, '') < hoje) return 'atrasada_entrega';
                return 'em_andamento';
            }
            return 'aguardando';
        }

        // Helper: calcula progresso de uma sequência de OP
        // ALINHADO com production.js: denominador = qtd_op por operação (sem multiplicar pelo nº de ops)
        function calcOp(op) {
            // Deduplica operações pela chave apptKey para evitar contar duas vezes o mesmo apontamento
            const operacoesUnicas = Object.values(
                op.operacoes.reduce((acc, o) => {
                    if (!acc[o.apptKey]) acc[o.apptKey] = o;
                    return acc;
                }, {})
            );

            let esperadas = 0;
            let apontadas = 0;
            for (const o of operacoesUnicas) {
                const qtd = o.qtd_op || Number(op.qtd_total) || 0;
                // Cada operação espera a qtd desta sequência (idêntico ao production.js)
                esperadas += qtd;
                // Produzido limitado ao teto da qtd planejada
                apontadas += Math.min(Number(o.qtd_apontada) || 0, qtd);
            }

            const progresso = esperadas > 0 ? Math.round((apontadas / esperadas) * 100) : 0;
            return {
                ...op,
                progresso,
                status: calcStatus(progresso, op.prazo_entrega_pedido),
                qtd_esperada_setor: esperadas,
                qtd_apontada_setor: apontadas
            };
        }

        // 7. Monta resultado por setor
        const resultado = [];
        for (const setor of setores) {
            const opMap = {};
            for (const recurso of setor.recursos) {
                if (!opsPorRecurso[recurso]) continue;
                for (const [key, op] of Object.entries(opsPorRecurso[recurso])) {
                    if (!opMap[key]) {
                        opMap[key] = { ...op, operacoes: [...op.operacoes] };
                    } else {
                        // Adiciona apenas operações novas (evita duplicar quando OP passa por
                        // múltiplos recursos do mesmo setor)
                        for (const oper of op.operacoes) {
                            if (!opMap[key].operacoes.some(o => o.apptKey === oper.apptKey)) {
                                opMap[key].operacoes.push(oper);
                            }
                        }
                    }
                }
            }

            let ops = Object.values(opMap).map(calcOp);
            if (status) {
                const sl = status.split(',');
                ops = ops.filter(o => sl.includes(o.status));
            }

            const totalEsp = ops.reduce((a, o) => a + o.qtd_esperada_setor, 0);
            const totalApt = ops.reduce((a, o) => a + o.qtd_apontada_setor, 0);

            resultado.push({
                id: setor.id,
                nome: setor.nome,
                cor: setor.cor,
                ops,
                kpis: {
                    total: ops.length,
                    concluidas: ops.filter(o => o.status === 'concluida').length,
                    em_andamento: ops.filter(o => o.status === 'em_andamento').length,
                    atrasadas: ops.filter(o => o.status === 'atrasada_entrega').length,
                    progresso_medio: totalEsp > 0 ? Math.round((totalApt / totalEsp) * 100) : 0
                }
            });
        }

        // 8. Card "Setor Nao Definido"
        const recursosSemSetor = Object.keys(opsPorRecurso).filter(r => r && !recursosVinculados.includes(r));
        if (recursosSemSetor.length > 0) {
            const opMap = {};
            for (const r of recursosSemSetor) {
                for (const [key, op] of Object.entries(opsPorRecurso[r])) {
                    if (!opMap[key]) opMap[key] = { ...op, operacoes: [...op.operacoes] };
                    else opMap[key].operacoes.push(...op.operacoes);
                }
            }
            const ops = Object.values(opMap).map(calcOp);
            const totalEsp = ops.reduce((a, o) => a + o.qtd_esperada_setor, 0);
            const totalApt = ops.reduce((a, o) => a + o.qtd_apontada_setor, 0);
            resultado.push({
                id: 'sem_setor',
                nome: 'Setor Nao Definido',
                cor: '#94a3b8',
                recursos_sem_setor: recursosSemSetor,
                ops,
                kpis: {
                    total: ops.length,
                    concluidas: ops.filter(o => o.status === 'concluida').length,
                    em_andamento: ops.filter(o => o.status === 'em_andamento').length,
                    atrasadas: ops.filter(o => o.status === 'atrasada_entrega').length,
                    progresso_medio: totalEsp > 0 ? Math.round((totalApt / totalEsp) * 100) : 0
                }
            });
        }

        if (no_paginate === 'true') {
            res.json(resultado);
        } else {
            res.json({
                data: resultado,
                meta: {
                    total: totalCount,
                    page,
                    limit,
                    totalPages: Math.ceil(totalCount / limit)
                }
            });
        }
    } catch (err) {
        console.error('[setores/visao] Erro geral:', err.message, err.stack);
        require('fs').appendFileSync('C:\\Users\\adm\\Desktop\\MetalFisa Anty\\server\\error_log.txt', err.stack + '\n');
        res.status(500).json({ error: err.message });
    }
});

const { sendText } = require('../services/whatsapp');
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');
const nodemailer = require('nodemailer');
const axios = require('axios');

const transporter = nodemailer.createTransport({
    host: 'smtp.task.com.br',
    port: 587,
    secure: false,
    auth: {
        user: 'sincometal@metalfisa.com.br',
        pass: 'Pro1042@sm'
    },
    tls: { rejectUnauthorized: false }
});

router.post('/visao/notify', async (req, res) => {
    try {
        const { filters, tipo, canal } = req.body; // tipo: 'responsibles', 'all', 'me', canal: 'whatsapp' or 'email'
        
        // 1. Fetch visao data (using local request)
        const port = process.env.PORT || 3002;
        const url = `http://127.0.0.1:${port}/api/pcp-setores/visao`;
        
        const visaoRes = await axios.get(url, { 
            params: { ...filters, no_paginate: 'true' },
            headers: { Authorization: req.headers.authorization }
        });
        const visaoData = visaoRes.data;

        // 2. Load all responsibles
        const [respRows] = await mysql.query(`
            SELECT r.setor_id, u.idUsuario, u.NomeCompleto, u.email, u.telefone 
            FROM pcp_setor_responsaveis r
            JOIN usuario u ON u.idUsuario = r.usuario_id
        `);
        
        let sentLog = [];
        
        // Formatter for WhatsApp
        const formatWhatsapp = (nome, setores) => {
            const linhas = setores.map(s => {
                const kpis = s.kpis || {};
                const progresso = kpis.progresso_medio || 0;
                const emoji = progresso >= 90 ? '✅' : progresso >= 60 ? '⚠️' : '❌';
                return `• *${s.nome}*: ${progresso}% concluído (${kpis.concluidas || 0}/${kpis.total || 0} OPs) ${emoji}`;
            }).join('\n');
            return `📊 *Evolução de Pedidos por Setor*\nOlá, ${nome}!\n\n${linhas}`;
        };

        // Formatter for E-mail (HTML)
        const formatEmailHtml = (nome, setores) => {
            let trs = setores.map(s => {
                const kpis = s.kpis || {};
                const progresso = kpis.progresso_medio || 0;
                const cor = progresso >= 90 ? '#10b981' : progresso >= 60 ? '#f59e0b' : '#ef4444';
                return `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>${s.nome}</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;"><span style="color: ${cor}; font-weight: bold;">${progresso}%</span></td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${kpis.concluidas || 0} / ${kpis.total || 0} OPs</td>
                </tr>
                `;
            }).join('');

            return `
                <div style="font-family: sans-serif; color: #334155;">
                    <h2 style="color: #0f172a;">📊 Evolução de Pedidos por Setor</h2>
                    <p>Olá, <strong>${nome}</strong>!</p>
                    <p>Segue o resumo da produção e andamento de seus setores:</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <thead style="background-color: #f8fafc;">
                            <tr>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1;">Setor</th>
                                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #cbd5e1;">Progresso</th>
                                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #cbd5e1;">OPs</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trs}
                        </tbody>
                    </table>
                    <p style="margin-top: 30px; font-size: 12px; color: #64748b;">Relatório gerado automaticamente pelo sistema SGQ MetalFisa.</p>
                </div>
            `;
        };

        // Grouping data by user
        let userSetores = {};
        if (tipo === 'responsibles') {
            for (const r of respRows) {
                if (!userSetores[r.idUsuario]) {
                    userSetores[r.idUsuario] = { user: r, setores: [] };
                }
                const sData = visaoData.find(v => v.id === r.setor_id);
                if (sData) userSetores[r.idUsuario].setores.push(sData);
            }
        } else if (tipo === 'all') {
            const uniqueUsers = {};
            respRows.forEach(r => uniqueUsers[r.idUsuario] = r);
            for (const user of Object.values(uniqueUsers)) {
                userSetores[user.idUsuario] = { user, setores: visaoData };
            }
        } else if (tipo === 'me') {
            const { telefone, email, nome } = req.body;
            userSetores['me'] = {
                user: { NomeCompleto: nome || 'Usuário', telefone: telefone, email: email },
                setores: visaoData
            };
        }

        // Sending Loop
        for (const [userId, data] of Object.entries(userSetores)) {
            if (data.setores.length > 0) {
                try {
                    if (canal === 'email' && data.user.email) {
                        const html = getCorporateEmailTemplate(formatEmailHtml(data.user.NomeCompleto, data.setores));
                        const info = await transporter.sendMail({
                            from: '"MetalFisa PCP" <sincometal@metalfisa.com.br>',
                            to: data.user.email,
                            subject: `Relatório PCP: Evolução de Pedidos - ${data.user.NomeCompleto}`,
                            html: html
                        });
                        sentLog.push({ target: data.user.NomeCompleto, canal: 'email', ok: true });
                    } 
                    else if (canal !== 'email' && data.user.telefone) { // default whatsapp
                        const texto = formatWhatsapp(data.user.NomeCompleto, data.setores);
                        const resultado = await sendText(data.user.telefone, texto, 'Visão Setores - ' + data.user.NomeCompleto);
                        sentLog.push({ target: data.user.NomeCompleto, canal: 'whatsapp', ok: resultado.some(x => x.ok) });
                    }
                } catch (sendErr) {
                    console.error(`Falha ao enviar ${canal} para ${data.user.NomeCompleto}:`, sendErr.message);
                    sentLog.push({ target: data.user.NomeCompleto, canal: canal, ok: false, error: sendErr.message });
                }
            }
        }

        res.json({ success: true, message: 'Relatórios processados!', sentLog });
    } catch (err) {
        console.error('[setores/visao/notify] Erro:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});


router.get('/fila-dependencias', async (req, res) => {
    try {
        const { recurso, data_fim } = req.query;
        if (!recurso) return res.status(400).json({ error: 'Recurso obrigatório.' });

        const dataLimite = data_fim ? data_fim.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');

        // 1. Pegar produtos que usam o recurso
        const sg2FilterRes = await db.query(
            "SELECT DISTINCT TRIM(g2_produto) as prod FROM sg2010 WHERE g2_recurso = $1 AND COALESCE(d_e_l_e_t_, ' ') = ' '",
            [recurso]
        );
        const produtosDoRecurso = new Set(sg2FilterRes.rows.map(r => r.prod));
        
        if (produtosDoRecurso.size === 0) return res.json({ inbound: [], outbound: [] });

        // 2. Buscar OPs ativas ate dataLimite
        const opsQuery = `
            SELECT
                RTRIM(pl.c2_num)       AS op,
                RTRIM(pl.c2_item)      AS item_op,
                RTRIM(pl.c2_sequen)    AS sequen,
                RTRIM(pl.c2_pedido)    AS pedido_venda,
                RTRIM(pl.c2_itempv)    AS item_pv,
                TRIM(pl.c2_produto)    AS cod_produto,
                COALESCE(pl.c2_quant, 0) AS qtd_total,
                RTRIM(pl.c2_datpri)    AS data_planejada,
                RTRIM(pl.c2_datprf)    AS data_fim_planejada,
                RTRIM(sb1.b1_desc)     AS desc_produto,
                RTRIM(c.a1_nome)     AS nome_cliente
            FROM sc2010 pl
            LEFT JOIN sb1010 sb1 ON pl.c2_produto = sb1.b1_cod AND COALESCE(sb1.d_e_l_e_t_, ' ') = ' '
            INNER JOIN sc5010 pv ON pl.c2_pedido = pv.c5_num AND COALESCE(pv.d_e_l_e_t_, ' ') = ' '
            INNER JOIN sc6010 c6 ON pl.c2_pedido = c6.c6_num AND pl.c2_itempv = c6.c6_item AND COALESCE(c6.d_e_l_e_t_, ' ') = ' '
            LEFT JOIN sa1010 c ON pv.c5_cliente = c.a1_cod AND pv.c5_lojacli = c.a1_loja AND COALESCE(c.d_e_l_e_t_, ' ') = ' '
            WHERE pl.c2_datpri <= $1
              AND COALESCE(pl.c2_quant, 0) > COALESCE(pl.c2_quje, 0)
              AND COALESCE(pl.d_e_l_e_t_, ' ') = ' '
              AND TRIM(pl.c2_pedido) != ''
              AND COALESCE(c6.c6_qtdven, 0) > COALESCE(c6.c6_qtdent, 0)
            ORDER BY RTRIM(pl.c2_datpri) ASC
        `;
        const { rows: allOps } = await db.query(opsQuery, [dataLimite]);

        // VERIFICAR CONFIGURAÇÃO DE PEDIDOS INATIVOS
        let activeOps = allOps;
        try {
            const [settingsResult] = await mysql.query("SELECT setting_value FROM app_settings WHERE setting_key = 'hide_inactive_orders'");
            const hideInactive = settingsResult && settingsResult[0] && (settingsResult[0].setting_value === '1' || settingsResult[0].setting_value === 'true');
            
            if (hideInactive) {
                const [inactiveResult] = await mysql.query("SELECT pedido_numero FROM app_pedidos_inativos");
                const inactivePedidos = new Set(inactiveResult.map(r => r.pedido_numero.trim()));
                activeOps = allOps.filter(o => !inactivePedidos.has(o.pedido_venda.trim()));
            }
        } catch (e) {
            console.error('Erro ao buscar status de pedidos inativos:', e);
        }
        
        // Filtrar OPs que possuem roteiro passando pelo recurso
        const ops = activeOps.filter(o => produtosDoRecurso.has(o.cod_produto));

        if (ops.length === 0) return res.json({ inbound: [], outbound: [] });

        // 2. Para cada cod_produto único, buscar o roteiro completo SG2
        const uniqueProducts = [...new Set(ops.map(o => o.cod_produto).filter(Boolean))];
        const routings = {};
        if (uniqueProducts.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < uniqueProducts.length; i += chunkSize) {
                const chunk = uniqueProducts.slice(i, i + chunkSize);
                const sg2Res = await db.query(`
                    SELECT 
                        TRIM(g2.g2_produto) as cod_produto,
                        RTRIM(g2.g2_recurso) as recurso,
                        RTRIM(g2.g2_descri)  as desc_operacao,
                        RTRIM(h1.h1_descri)  as desc_recurso,
                        RTRIM(g2.g2_operac)  as operacao
                    FROM sg2010 g2
                    LEFT JOIN sh1010 h1 ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, ' ') = ' '
                    WHERE g2.g2_produto = ANY($1)
                      AND COALESCE(g2.d_e_l_e_t_, ' ') = ' '
                    ORDER BY g2.g2_produto, g2.g2_operac ASC
                `, [chunk]);

                sg2Res.rows.forEach(r => {
                    if (!routings[r.cod_produto]) routings[r.cod_produto] = [];
                    routings[r.cod_produto].push(r);
                });
            }
        }

        // 3. Buscar os apontamentos no MySQL
        const opNumbers = [...new Set(ops.map(o => o.op).filter(Boolean))];
        const apptsMap = {};
        if (opNumbers.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < opNumbers.length; i += chunkSize) {
                const chunk = opNumbers.slice(i, i + chunkSize);
                const placeholders = chunk.map(() => '?').join(',');
                const [mysqlRows] = await mysql.query(`
                    SELECT 
                        op_numero, op_item, op_sequencia, operacao_codigo, 
                        SUM(quantidade) AS total_produzido,
                        MAX(COALESCE(data_fim, created_at)) as ultima_data,
                        SUBSTRING_INDEX(GROUP_CONCAT(usuario ORDER BY COALESCE(data_fim, created_at) DESC SEPARATOR ','), ',', 1) AS ultimo_usuario
                    FROM app_production_appointments
                    WHERE op_numero IN (${placeholders})
                    GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
                `, chunk);
                mysqlRows.forEach(row => {
                    const key = `${row.op_numero}_${row.op_item}_${row.op_sequencia}_${row.operacao_codigo}`;
                    apptsMap[key] = {
                        total: parseFloat(row.total_produzido) || 0,
                        data: row.ultima_data,
                        usuario: row.ultimo_usuario
                    };
                });
            }
        }

        // 4. Lógica de Inbound e Outbound
        const inbound = [];
        const outbound = [];

        for (const op of ops) {
            const route = routings[op.cod_produto] || [];
            const myIndex = route.findIndex(r => r.recurso === recurso);
            if (myIndex === -1) continue;
            
            const myOpInfo = route[myIndex];
            const myAppt = apptsMap[`${op.op}_${op.item_op}_${op.sequen}_${myOpInfo.operacao}`];
            const myApontado = myAppt ? myAppt.total : 0;
            const myData = myAppt ? myAppt.data : null;
            const myUsuario = myAppt ? myAppt.usuario : null;

            const prevOpInfo = myIndex > 0 ? route[myIndex - 1] : null;
            const nextOpInfo = myIndex < route.length - 1 ? route[myIndex + 1] : null;

            let prevApontado = op.qtd_total;
            let prevData = null;
            let prevUsuario = null;
            if (prevOpInfo) {
                const prevAppt = apptsMap[`${op.op}_${op.item_op}_${op.sequen}_${prevOpInfo.operacao}`];
                if (prevAppt) {
                    prevApontado = prevAppt.total;
                    prevData = prevAppt.data;
                    prevUsuario = prevAppt.usuario;
                } else {
                    prevApontado = 0;
                }
            }

            // Inbound: Anterior tem pendência
            if (prevOpInfo && prevApontado < op.qtd_total) {
                inbound.push({
                    ...op,
                    recurso_referencia: prevOpInfo.recurso,
                    desc_recurso_referencia: prevOpInfo.desc_recurso,
                    qtd_pendente: op.qtd_total - prevApontado,
                    qtd_apontada: prevApontado,
                    status: 'Atrasado na Origem'
                });
            }

            // Outbound: Eu tenho pendência (quantidade na minha mão > produzida)
            const qtdNaMinhaMao = prevApontado - myApontado;
            if (qtdNaMinhaMao > 0) {
                outbound.push({
                    ...op,
                    recurso_referencia: nextOpInfo ? nextOpInfo.recurso : 'FINAL',
                    desc_recurso_referencia: nextOpInfo ? nextOpInfo.desc_recurso : 'Expedição/Fim',
                    qtd_pendente: qtdNaMinhaMao,
                    qtd_apontada: myApontado,
                    status: 'Na minha Fila'
                });
            }
        }

        res.json({ inbound, outbound });
    } catch (err) {
        console.error('[setores/fila-dependencias] Erro:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
