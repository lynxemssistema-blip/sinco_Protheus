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
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_setor_usuario (setor_id, usuario_id),
            FOREIGN KEY (setor_id) REFERENCES pcp_setores(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
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
            SELECT r.id as vinculo_id, r.setor_id, r.usuario_id, u.NomeCompleto, u.email, u.telefone
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

// ─── GET /api/pcp-setores/visao ───────────────────────────────────────────────
// Evolução de produção por setor: OPs x Setores
// - Estrutura (roteiro) vem do Protheus: SC2 + SG2
// - Apontamentos vem do MySQL: app_production_appointments
// - NÃO usa SH6 (Protheus) por incompatibilidade de schema
router.get('/visao', async (req, res) => {
    const { pedido, cliente, produto, data_inicio, data_fim, status, apenas_pendentes } = req.query;
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
            params.push(`%${pedido}%`);
            conditions.push(`(COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) LIKE $${params.length} OR pl.c2_num LIKE $${params.length})`);
        }
        let joinSb1 = false;
        let joinSa1Sc5 = false;

        if (cliente) {
            params.push(`%${cliente.toUpperCase()}%`);
            conditions.push(`UPPER(sa1.a1_nome) LIKE $${params.length}`);
            joinSa1Sc5 = true;
        }
        if (produto) {
            params.push(`%${produto.toUpperCase()}%`);
            conditions.push(`(UPPER(pl.c2_produto) LIKE $${params.length} OR UPPER(sb1.b1_desc) LIKE $${params.length})`);
            joinSb1 = true;
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

        const opsQuery = `
            SELECT
                RTRIM(pl.c2_num)       AS op,
                RTRIM(pl.c2_item)      AS item_op,
                RTRIM(pl.c2_sequen)    AS sequen,
                COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) AS pedido_venda,
                COALESCE(NULLIF(TRIM(pl.c2_itempv), ''), NULLIF(TRIM(root_op.c2_itempv), '')) AS item_pv,
                TRIM(pl.c2_produto)    AS cod_produto_op_raw,
                RTRIM(pl.c2_produto)   AS cod_produto_op,
                COALESCE(pl.c2_quant, 0) AS qtd_total,
                COALESCE(pl.c2_quje, 0)  AS qtd_realizada_header
                ${joinSb1 ? ', RTRIM(sb1.b1_desc) AS desc_produto' : ''}
                ${joinSa1Sc5 ? ', RTRIM(sa1.a1_nome) AS nome_cliente' : ''}
            FROM sc2010 pl
            LEFT JOIN sc2010 root_op ON root_op.c2_num = pl.c2_num AND root_op.c2_item = pl.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, ' ') = ' '
            ${joinSb1 ? `LEFT JOIN sb1010 sb1 ON sb1.b1_cod = pl.c2_produto AND COALESCE(sb1.d_e_l_e_t_, ' ') = ' '` : ''}
            ${joinSa1Sc5 ? `LEFT JOIN sc5010 sc5 ON sc5.c5_num = COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) AND COALESCE(sc5.d_e_l_e_t_, ' ') = ' ' LEFT JOIN sa1010 sa1 ON sa1.a1_cod = sc5.c5_cliente AND sa1.a1_loja = sc5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, ' ') = ' '` : ''}
            WHERE ${conditions.join(' AND ')}
            ORDER BY pl.c2_datpri DESC
            LIMIT 4000
        `;

        let opsRows = [];
        try {
            const result = await db.query(opsQuery, params);
            const initialRows = result.rows;

            if (initialRows.length > 0) {
                // Fetch missing descriptions (sb1)
                if (!joinSb1) {
                    const productCodes = [...new Set(initialRows.map(r => r.cod_produto_op_raw).filter(Boolean))];
                    if (productCodes.length > 0) {
                        const sb1Res = await db.query(`SELECT TRIM(b1_cod) as cod, RTRIM(b1_desc) as desc FROM sb1010 WHERE b1_cod = ANY($1) AND COALESCE(d_e_l_e_t_, ' ') = ' '`, [productCodes]);
                        const productMap = {};
                        sb1Res.rows.forEach(p => productMap[p.cod] = p.desc);
                        initialRows.forEach(r => r.desc_produto = productMap[r.cod_produto_op_raw] || '');
                    }
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
                            if (!joinSa1Sc5) r.nome_cliente = info.nome_cliente;
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
                                TRIM(g2_produto) as cod_produto_op_raw,
                                RTRIM(g2_recurso) as recurso,
                                RTRIM(g2_descri)  as desc_operacao,
                                RTRIM(g2_operac)  as operacao
                            FROM sg2010
                            WHERE g2_produto = ANY($1)
                              AND COALESCE(d_e_l_e_t_, ' ') = ' '
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
                            opsRows.push({ ...op, ...oper });
                        }
                    } else {
                        opsRows.push({ ...op, recurso: null, desc_operacao: null, operacao: null });
                    }
                }
            }
        } catch (protheusErr) {
            console.error('[setores/visao] Erro Protheus:', protheusErr.message);
            return res.status(500).json({ error: protheusErr.message });
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

            if (!opsPorRecurso[recurso]) opsPorRecurso[recurso] = {};
            if (!opsPorRecurso[recurso][key]) {
                opsPorRecurso[recurso][key] = { ...row, operacoes: [] };
            }
            opsPorRecurso[recurso][key].operacoes.push({
                apptKey,                          // chave única para deduplicar depois
                operacao: row.operacao,
                desc_operacao: row.desc_operacao,
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

        res.json(resultado);
    } catch (err) {
        console.error('[setores/visao] Erro geral:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
