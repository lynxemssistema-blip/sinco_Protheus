const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');

// GET /api/clients/search
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        const cleanQ = (q || '').trim();

        // 1. Busca nativa no SINCO (erp_clientes e erp_fornecedores no MySQL)
        if (!cleanQ || cleanQ.length < 2) {
            const [topClients] = await mysqlPool.query(`
                SELECT 
                    codigo,
                    loja,
                    razao_social AS nome,
                    nome_fantasia AS nreduz,
                    'Cliente' AS tipo
                FROM erp_clientes
                WHERE status = 'ATIVO' OR status IS NULL
                ORDER BY razao_social ASC
                LIMIT 50
            `);
            if (topClients && topClients.length > 0) {
                return res.json(topClients);
            }
        } else {
            const term = `%${cleanQ}%`;
            const [partners] = await mysqlPool.query(`
                SELECT 
                    codigo,
                    loja,
                    razao_social AS nome,
                    nome_fantasia AS nreduz,
                    endereco,
                    bairro,
                    cidade,
                    uf,
                    cep,
                    telefone,
                    'Cliente' AS tipo
                FROM erp_clientes
                WHERE (codigo LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ?)
                UNION ALL
                SELECT 
                    codigo,
                    loja,
                    razao_social AS nome,
                    nome_fantasia AS nreduz,
                    endereco,
                    bairro,
                    cidade,
                    uf,
                    cep,
                    telefone,
                    'Fornecedor' AS tipo
                FROM erp_fornecedores
                WHERE (codigo LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ?)
                LIMIT 50
            `, [term, term, term, term, term, term]);

            if (partners && partners.length > 0) {
                return res.json(partners);
            }
        }

        // 2. Fallback no Protheus legado se Postgres estiver acessível
        try {
            if (!cleanQ || cleanQ.length < 2) {
                const queryTop = `
                    WITH TopClientes AS (
                        SELECT TRIM(z1_cliente) AS z1_cliente
                        FROM public.sz1010
                        WHERE COALESCE(d_e_l_e_t_, '') <> '*'
                        GROUP BY TRIM(z1_cliente)
                        ORDER BY COUNT(*) DESC
                        LIMIT 20
                    )
                    SELECT 
                        TRIM(a1_cod) AS codigo,
                        TRIM(a1_loja) AS loja,
                        TRIM(a1_nome) AS nome,
                        TRIM(a1_nreduz) AS nreduz,
                        'Cliente' AS tipo
                    FROM public.sa1010
                    INNER JOIN TopClientes ON TRIM(a1_cod) = TopClientes.z1_cliente
                    WHERE COALESCE(d_e_l_e_t_, '') <> '*'
                    ORDER BY a1_nome
                `;
                const resultTop = await db.query(queryTop);
                return res.json(resultTop.rows);
            }

            const searchTerm = `%${cleanQ}%`;
            const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flexiblePattern = escaped.replace(/(.)\1*/gi, '$1+');

            const query = `
                WITH partners AS (
                    SELECT 
                        TRIM(a1_cod) AS codigo,
                        TRIM(a1_loja) AS loja,
                        TRIM(a1_nome) AS nome,
                        TRIM(a1_nreduz) AS nreduz,
                        TRIM(a1_end) AS endereco,
                        TRIM(a1_bairro) AS bairro,
                        TRIM(a1_mun) AS cidade,
                        TRIM(a1_est) AS uf,
                        TRIM(a1_cep) AS cep,
                        TRIM(a1_tel) AS telefone,
                        'Cliente' AS tipo
                    FROM public.sa1010
                    WHERE 
                        COALESCE(d_e_l_e_t_, '') <> '*'
                        AND (
                            a1_cod ILIKE $1 
                            OR a1_nome ILIKE $1 
                            OR a1_nreduz ILIKE $1
                            OR a1_nome ~* $2
                            OR a1_nreduz ~* $2
                        )
                    UNION ALL
                    SELECT 
                        TRIM(a2_cod) AS codigo,
                        TRIM(a2_loja) AS loja,
                        TRIM(a2_nome) AS nome,
                        TRIM(a2_nreduz) AS nreduz,
                        TRIM(a2_end) AS endereco,
                        TRIM(a2_bairro) AS bairro,
                        TRIM(a2_mun) AS cidade,
                        TRIM(a2_est) AS uf,
                        TRIM(a2_cep) AS cep,
                        TRIM(a2_tel) AS telefone,
                        'Fornecedor' AS tipo
                    FROM public.sa2010
                    WHERE 
                        COALESCE(d_e_l_e_t_, '') <> '*'
                        AND (
                            a2_cod ILIKE $1 
                            OR a2_nome ILIKE $1 
                            OR a2_nreduz ILIKE $1
                            OR a2_nome ~* $2
                            OR a2_nreduz ~* $2
                        )
                )
                SELECT * FROM partners
                ORDER BY 
                    CASE 
                        WHEN codigo = $3 THEN 1
                        WHEN nome ILIKE $1 THEN 2
                        WHEN nreduz ILIKE $1 THEN 3
                        ELSE 4
                    END,
                    nome
                LIMIT 50
            `;
            const result = await db.query(query, [searchTerm, flexiblePattern, cleanQ]);
            return res.json(result.rows);
        } catch (_) {
            return res.json([]);
        }

    } catch (err) {
        console.error('Error searching clients:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Initialization: Create the solicitacoes_cliente table if it doesn't exist
(async function initTable() {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS solicitacoes_cliente (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cliente_nome VARCHAR(255),
                pedido_metalfisa VARCHAR(50),
                pedido_cliente VARCHAR(50),
                produto VARCHAR(100),
                ref_cliente VARCHAR(100),
                tipo_solicitacao VARCHAR(100),
                observacao TEXT,
                status VARCHAR(50) DEFAULT 'Pendente',
                criado_por VARCHAR(100),
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela solicitacoes_cliente verificada/criada (MySQL).');

        // Verificar e adicionar colunas de resposta se não existirem
        const [columns] = await mysqlPool.query("SHOW COLUMNS FROM solicitacoes_cliente");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('resposta')) {
            await mysqlPool.query("ALTER TABLE solicitacoes_cliente ADD COLUMN resposta TEXT NULL");
            console.log('✅ Coluna "resposta" adicionada à tabela solicitacoes_cliente.');
        }
        if (!columnNames.includes('respondido_por')) {
            await mysqlPool.query("ALTER TABLE solicitacoes_cliente ADD COLUMN respondido_por VARCHAR(100) NULL");
            console.log('✅ Coluna "respondido_por" adicionada à tabela solicitacoes_cliente.');
        }
        if (!columnNames.includes('respondido_em')) {
            await mysqlPool.query("ALTER TABLE solicitacoes_cliente ADD COLUMN respondido_em TIMESTAMP NULL DEFAULT NULL");
            console.log('✅ Coluna "respondido_em" adicionada à tabela solicitacoes_cliente.');
        }
    } catch (e) {
        console.error('Erro ao inicializar tabela solicitacoes_cliente no MySQL:', e);
    }
})();

// POST /api/clients/solicitacoes
router.post('/solicitacoes', async (req, res) => {
    try {
        const { cliente_nome, pedido_metalfisa, pedido_cliente, produto, ref_cliente, tipo_solicitacao, observacao, criado_por } = req.body;
        const [result] = await mysqlPool.query(`
            INSERT INTO solicitacoes_cliente (cliente_nome, pedido_metalfisa, pedido_cliente, produto, ref_cliente, tipo_solicitacao, observacao, criado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [cliente_nome, pedido_metalfisa, pedido_cliente, produto, ref_cliente, tipo_solicitacao, observacao, criado_por]);

        const insertId = result.insertId;

        // Enviar notificação pro PCP via log do sistema / banco
        console.log(`[Hermes/PCP Notify] Nova solicitacao de cliente: ${cliente_nome} -> ${tipo_solicitacao} (Item: ${produto || pedido_metalfisa})`);
        
        try {
            // Tenta inserir na memoria do hermes_chat_memory (MySQL) para o Hermes poder ver.
            await mysqlPool.query(`
                INSERT INTO hermes_chat_memory (id_usuario, role, text) 
                VALUES (0, 'system', ?)
            `, [`NOTIFICAÇÃO: O cliente ${cliente_nome} enviou uma solicitação de ${tipo_solicitacao} para o pedido ${pedido_metalfisa || '-'} / produto ${produto || '-'}.`]);
        } catch (e) {
            console.error('Falha ao notificar Hermes via MySQL', e);
        }

        res.json({ success: true, data: { id: insertId, cliente_nome, pedido_metalfisa, pedido_cliente, produto, ref_cliente, tipo_solicitacao, observacao, criado_por } });
    } catch (e) {
        console.error('Erro ao salvar solicitacao:', e);
        res.status(500).json({ error: 'Erro ao salvar solicitação.' });
    }
});

// GET /api/clients/solicitacoes
router.get('/solicitacoes', async (req, res) => {
    try {
        // 1. Sincronizar solicitações "Pendente" ou "Em Análise" com o Protheus
        try {
            const [activeSols] = await mysqlPool.query(
                "SELECT id, pedido_metalfisa, produto FROM solicitacoes_cliente WHERE status IN ('Pendente', 'Em Análise') AND pedido_metalfisa IS NOT NULL AND produto IS NOT NULL"
            );
            
            const validSols = activeSols.filter(s => {
                const p = String(s.pedido_metalfisa).trim();
                const prod = String(s.produto).trim();
                return p.length > 0 && prod.length > 0 && /^[a-zA-Z0-9]+$/.test(p);
            });

            if (validSols.length > 0) {
                const clauses = [];
                const pgParams = [];
                validSols.forEach((sol, idx) => {
                    const pedPadded = String(sol.pedido_metalfisa).trim().padEnd(6, ' ');
                    const prodPadded = String(sol.produto).trim().padEnd(15, ' ');
                    pgParams.push(pedPadded, prodPadded);
                    clauses.push(`(c6.c6_num = $${idx * 2 + 1} AND c6.c6_produto = $${idx * 2 + 2})`);
                });

                const pgSql = `
                    SELECT TRIM(c6.c6_num) AS pedido, TRIM(c6.c6_produto) AS produto,
                           (SUM(COALESCE(c6.c6_qtdven, 0)) - SUM(COALESCE(c6.c6_qtdent, 0)))::numeric(18,4) AS saldo
                    FROM public.sc6010 c6
                    JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial AND COALESCE(c5.d_e_l_e_t_, '') = ''
                    WHERE COALESCE(c6.d_e_l_e_t_, '') = '' AND (${clauses.join(' OR ')})
                    GROUP BY TRIM(c6.c6_num), TRIM(c6.c6_produto)
                `;

                const pgRes = await db.query(pgSql, pgParams);
                const balanceMap = new Map();
                pgRes.rows.forEach(r => {
                    balanceMap.set(`${r.pedido}|${r.produto}`, parseFloat(r.saldo) || 0);
                });

                for (const sol of validSols) {
                    const key = `${String(sol.pedido_metalfisa).trim()}|${String(sol.produto).trim()}`;
                    if (balanceMap.has(key)) {
                        const saldo = balanceMap.get(key);
                        if (saldo <= 0) {
                            await mysqlPool.query(
                                "UPDATE solicitacoes_cliente SET status = 'Atendida', resposta = 'Solicitação concluída automaticamente via faturamento integral do item.', respondido_por = 'SISTEMA', respondido_em = NOW() WHERE id = ?",
                                [sol.id]
                            );
                            console.log(`[Solicitacao Auto-Close] Solicitação #${sol.id} fechada automaticamente.`);
                        }
                    }
                }
            }
        } catch (syncErr) {
            console.error('[Clients Service] Erro ao sincronizar solicitações:', syncErr);
        }

        // 2. Buscar solicitações atualizadas
        const sql = 'SELECT * FROM solicitacoes_cliente ORDER BY criado_em DESC LIMIT 100';
        const [rows] = await mysqlPool.query(sql);

        // 3. Enriquecer os dados com saldo do Protheus e status de faturamento
        const balanceMap = new Map();
        const openBillingSet = new Set();

        if (rows.length > 0) {
            // Buscar solicitações de faturamento em aberto no MySQL
            try {
                const [openBillingRows] = await mysqlPool.query(`
                    SELECT DISTINCT TRIM(i.pedido) AS pedido, TRIM(i.codigo_produto) AS codigo_produto 
                    FROM app_faturamento_solicitacao_itens i
                    JOIN app_faturamento_solicitacoes s ON i.solicitacao_id = s.id
                    WHERE s.status NOT IN ('Atendido', 'Cancelado')
                `);
                openBillingRows.forEach(ob => {
                    openBillingSet.add(`${ob.pedido}|${ob.codigo_produto}`);
                });
            } catch (mySqlErr) {
                console.error('[Clients GET] Erro ao buscar solicitacoes de faturamento em aberto:', mySqlErr);
            }

            // Buscar saldos do Protheus (Postgres)
            const pgClauses = [];
            const pgParams = [];
            const uniqueItems = [];
            const itemKeys = new Set();

            rows.forEach(r => {
                const ped = String(r.pedido_metalfisa || '').trim();
                const prod = String(r.produto || '').trim();
                const key = `${ped}|${prod}`;
                if (ped && prod && !itemKeys.has(key) && /^[a-zA-Z0-9]+$/.test(ped)) {
                    itemKeys.add(key);
                    uniqueItems.push({ ped, prod });
                }
            });

            if (uniqueItems.length > 0) {
                try {
                    uniqueItems.forEach((item, idx) => {
                        const pedPadded = item.ped.padEnd(6, ' ');
                        const prodPadded = item.prod.padEnd(15, ' ');
                        pgParams.push(pedPadded, prodPadded);
                        pgClauses.push(`(c6.c6_num = $${idx * 2 + 1} AND c6.c6_produto = $${idx * 2 + 2})`);
                    });

                    const pgSql = `
                        SELECT TRIM(c6.c6_num) AS pedido, TRIM(c6.c6_produto) AS produto,
                               (SUM(COALESCE(c6.c6_qtdven, 0)) - SUM(COALESCE(c6.c6_qtdent, 0)))::numeric(18,4) AS saldo
                        FROM public.sc6010 c6
                        JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial AND COALESCE(c5.d_e_l_e_t_, '') = ''
                        WHERE COALESCE(c6.d_e_l_e_t_, '') = '' AND (${pgClauses.join(' OR ')})
                        GROUP BY TRIM(c6.c6_num), TRIM(c6.c6_produto)
                    `;

                    const pgRes = await db.query(pgSql, pgParams);
                    pgRes.rows.forEach(r => {
                        balanceMap.set(`${r.pedido}|${r.produto}`, parseFloat(r.saldo) || 0);
                    });
                } catch (pgErr) {
                    console.error('[Clients GET] Erro ao buscar saldos Protheus:', pgErr);
                }
            }
        }

        // Mapear linhas enriquecidas
        const enrichedRows = rows.map(r => {
            const ped = String(r.pedido_metalfisa || '').trim();
            const prod = String(r.produto || '').trim();
            const key = `${ped}|${prod}`;

            return {
                ...r,
                saldo_faturar: ped && prod && balanceMap.has(key) ? balanceMap.get(key) : null,
                tem_faturamento_aberto: ped && prod ? openBillingSet.has(key) : false
            };
        });

        res.json(enrichedRows);
    } catch (e) {
        console.error('Erro ao buscar solicitacoes:', e);
        res.status(500).json({ error: 'Erro ao buscar solicitações.' });
    }
});

// PUT /api/clients/solicitacoes/:id
router.put('/solicitacoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { resposta, status } = req.body;

        // Bloquear se for usuário externo (cliente)
        if (req.user?.tipoExterno === 'cliente' || req.user?.idCliente) {
            return res.status(403).json({ error: 'Acesso negado. Clientes externos não podem responder a solicitações.' });
        }

        const [existing] = await mysqlPool.query("SELECT id FROM solicitacoes_cliente WHERE id = ?", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }

        const respondido_por = req.user?.nome || 'Administrador';

        await mysqlPool.query(
            `UPDATE solicitacoes_cliente 
             SET resposta = ?, status = ?, respondido_por = ?, respondido_em = NOW() 
             WHERE id = ?`,
            [resposta, status, respondido_por, id]
        );

        res.json({ success: true, message: 'Solicitação respondida com sucesso.' });
    } catch (e) {
        console.error('Erro ao responder solicitação:', e);
        res.status(500).json({ error: 'Erro ao responder solicitação.' });
    }
});

module.exports = router;
