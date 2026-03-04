const express = require('express');
const router = express.Router();
const db = require('../db'); // Postgres
const mysqlPool = require('../services/mysqlService'); // MySQL

// --- FORNECEDORES (Postgres SA2010) ---
router.get('/clientes', async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT 
                a2.a2_cod as codigo, 
                a2.a2_loja as loja, 
                a2.a2_nome as nome, 
                a2.a2_nreduz as nreduz,
                a2.a2_cgc as cnpj,
                a2.a2_inscr as ie,
                a2.a2_end as endereco,
                a2.a2_bairro as bairro,
                a2.a2_mun as cidade,
                a2.a2_est as uf,
                a2.a2_cep as cep,
                a2.a2_tel as telefone,
                a2.a2_email as email
            FROM public.sa2010 a2
            WHERE COALESCE(a2.d_e_l_e_t_, '') IN ('', ' ')
              AND a2.a2_tipo = 'J'
        `;

        const params = [];
        if (search) {
            query += ` AND (
                a2.a2_nome ILIKE $1 OR 
                a2.a2_nreduz ILIKE $1 OR 
                a2.a2_cod ILIKE $1
            )`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY a2.a2_nome LIMIT 2000`;

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar fornecedores:', err);
        res.status(500).json({ error: 'Erro ao buscar fornecedores' });
    }
});

// --- TIPOS (MySQL) ---
router.get('/types', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM app_romaneio_types ORDER BY description');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ROMANEIOS (MySQL) ---

// --- MIGRATION (Auto-run) ---
(async () => {
    try {
        const conn = await mysqlPool.getConnection();

        // Coluna data_liberacao
        try {
            await conn.execute("ALTER TABLE app_romaneios ADD COLUMN data_liberacao DATETIME DEFAULT CURRENT_TIMESTAMP");
            console.log('✅ [Romaneios] Coluna data_liberacao criada.');
        } catch (e) {
            if (e.errno !== 1060) console.error('⚠️ [Romaneios] Erro data_liberacao:', e.message);
        }

        // Coluna data_previsao_retorno
        try {
            await conn.execute("ALTER TABLE app_romaneios ADD COLUMN data_previsao_retorno DATE NULL");
            console.log('✅ [Romaneios] Coluna data_previsao_retorno criada.');
        } catch (e) {
            if (e.errno !== 1060) console.error('⚠️ [Romaneios] Erro data_previsao_retorno:', e.message);
        }

        // Coluna valor_unitario em ITEMS
        try {
            await conn.execute("ALTER TABLE app_romaneio_items ADD COLUMN valor_unitario DECIMAL(15,2) DEFAULT 0.00");
            console.log('✅ [Romaneios] Coluna valor_unitario criada em ITENS.');
        } catch (e) {
            if (e.errno !== 1060) console.error('⚠️ [Romaneios] Erro valor_unitario:', e.message);
        }

        conn.release();
    } catch (err) {
        console.error('⚠️ [Romaneios] Falha geral na migração:', err.message);
    }
})();

// Criar Romaneio (Cabeçalho)
router.post('/', async (req, res) => {
    try {
        const {
            cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
            cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
            motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
            usuario, data_liberacao, data_previsao_retorno
        } = req.body;

        const [result] = await mysqlPool.execute(
            `INSERT INTO app_romaneios (
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
                usuario, data_liberacao, data_previsao_retorno
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade || null, veiculo_modelo, veiculo_placa,
                usuario || 'Sistema',
                data_liberacao || new Date(), // Default to now if not provided
                data_previsao_retorno || null
            ]
        );

        res.json({ id: result.insertId, message: 'Romaneio criado com sucesso!' });
    } catch (err) {
        console.error('Erro ao criar romaneio:', err);
        res.status(500).json({ error: err.message });
    }
});

// Atualizar Romaneio (Cabeçalho)
router.put('/:id', async (req, res) => {
    try {
        const {
            cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
            cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
            motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
            data_liberacao, data_previsao_retorno
        } = req.body;

        await mysqlPool.execute(
            `UPDATE app_romaneios SET
                cliente_cod=?, cliente_loja=?, cliente_nome=?, tipo_id=?, observacao_geral=?,
                cliente_endereco=?, cliente_bairro=?, cliente_cidade=?, cliente_uf=?, cliente_cep=?, cliente_telefone=?,
                motorista_nome=?, motorista_cnh=?, motorista_cnh_validade=?, veiculo_modelo=?, veiculo_placa=?,
                data_liberacao=?, data_previsao_retorno=?
             WHERE id = ?`,
            [
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade || null, veiculo_modelo, veiculo_placa,
                data_liberacao, data_previsao_retorno || null,
                req.params.id
            ]
        );

        res.json({ message: 'Romaneio atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar romaneio:', err);
        res.status(500).json({ error: err.message });
    }
});

// Buscar Romaneios com Filtros
router.get('/', async (req, res) => {
    try {
        const { search, status, startDate, endDate } = req.query;

        let query = `
            SELECT r.*, t.description as tipo_descricao 
            FROM app_romaneios r
            LEFT JOIN app_romaneio_types t ON r.tipo_id = t.id
            WHERE 1=1
        `;

        const params = [];

        if (search) {
            query += ` AND (r.cliente_nome LIKE ? OR r.cliente_cod LIKE ? OR r.id LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status) {
            query += ` AND r.status = ?`;
            params.push(status);
        }

        if (startDate) {
            query += ` AND DATE(r.data_liberacao) >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND DATE(r.data_liberacao) <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY r.data_liberacao DESC, r.created_at DESC LIMIT 100`;

        const [rows] = await mysqlPool.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar Romaneio por ID com Itens
router.get('/:id', async (req, res) => {
    try {
        const [romaneio] = await mysqlPool.query(`
            SELECT r.*, t.description as tipo_descricao 
            FROM app_romaneios r
            LEFT JOIN app_romaneio_types t ON r.tipo_id = t.id
            WHERE r.id = ?
        `, [req.params.id]);

        if (romaneio.length === 0) return res.status(404).json({ error: 'Romaneio não encontrado' });

        const [itens] = await mysqlPool.query(`
            SELECT i.*, d.peso_kg, d.area_pintura_m2 
            FROM app_romaneio_items i
            LEFT JOIN produtos_docs d ON d.produto_codigo = i.codigo_produto
            WHERE i.romaneio_id = ?
        `, [req.params.id]);

        res.json({ ...romaneio[0], itens });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Adicionar Item
router.post('/:id/items', async (req, res) => {
    try {
        const { pedido, item_pedido, codigo_produto, descricao_produto, quantidade, comentario, valor_unitario } = req.body;
        const romaneio_id = req.params.id;

        await mysqlPool.execute(
            `INSERT INTO app_romaneio_items(romaneio_id, pedido, item_pedido, codigo_produto, descricao_produto, quantidade, comentario, valor_unitario)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
            [romaneio_id, pedido, item_pedido, codigo_produto, descricao_produto, quantidade, comentario, valor_unitario || 0]
        );

        res.json({ message: 'Item adicionado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Atualizar Status
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await mysqlPool.execute('UPDATE app_romaneios SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status atualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deletar Romaneio
router.delete('/:id', async (req, res) => {
    try {
        await mysqlPool.execute('DELETE FROM app_romaneios WHERE id = ?', [req.params.id]);
        res.json({ message: 'Romaneio excluído com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ITENS ---
// Editar Item
router.put('/:id/items/:itemId', async (req, res) => {
    try {
        const { quantidade, comentario, valor_unitario } = req.body;
        await mysqlPool.execute(
            'UPDATE app_romaneio_items SET quantidade = ?, comentario = ?, valor_unitario = ? WHERE id = ? AND romaneio_id = ?',
            [quantidade, comentario, valor_unitario || 0, req.params.itemId, req.params.id]
        );
        res.json({ message: 'Item atualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deletar Item
router.delete('/:id/items/:itemId', async (req, res) => {
    try {
        await mysqlPool.execute(
            'DELETE FROM app_romaneio_items WHERE id = ? AND romaneio_id = ?',
            [req.params.itemId, req.params.id]
        );
        res.json({ message: 'Item removido' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REVISÕES ---
// Criar Nova Revisão
router.post('/:id/revisions', async (req, res) => {
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        const romaneioId = req.params.id;
        const { reason } = req.body;

        // 1. Get current data (Header + Items)
        const [rows] = await conn.query('SELECT * FROM app_romaneios WHERE id = ?', [romaneioId]);
        if (rows.length === 0) throw new Error('Romaneio não encontrado');
        const header = rows[0];

        const [items] = await conn.query('SELECT * FROM app_romaneio_items WHERE romaneio_id = ?', [romaneioId]);

        const snapshot = { header, items };

        // 2. Insert into revisions table
        const currentRev = header.current_revision || 1;
        await conn.execute(
            'INSERT INTO app_romaneio_revisions (romaneio_id, revision_number, snapshot_data, reason) VALUES (?, ?, ?, ?)',
            [romaneioId, currentRev, JSON.stringify(snapshot), reason]
        );

        // 3. Increment revision in main table
        await conn.execute('UPDATE app_romaneios SET current_revision = current_revision + 1 WHERE id = ?', [romaneioId]);

        await conn.commit();
        res.json({ message: 'Revisão criada com sucesso', newRevision: currentRev + 1 });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Listar Revisões
router.get('/:id/revisions', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT id, revision_number, created_at, reason FROM app_romaneio_revisions WHERE romaneio_id = ? ORDER BY revision_number DESC',
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obter Detalhes da Revisão
router.get('/:id/revisions/:revId', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_romaneio_revisions WHERE id = ? AND romaneio_id = ?',
            [req.params.revId, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Revisão não encontrada' });

        // Parse JSON data before sending
        const data = rows[0];
        if (typeof data.snapshot_data === 'string') {
            data.snapshot_data = JSON.parse(data.snapshot_data);
        }

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- SUBSYSTEM: SEARCH ITEMS ---
router.get('/items/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 3) return res.json([]);

        const query = `
            SELECT 
                i.id, i.romaneio_id, i.codigo_produto, i.descricao_produto, i.quantidade,
                i.pedido, i.item_pedido,
                r.cliente_nome, r.data_liberacao, r.data_previsao_retorno, r.status
            FROM app_romaneio_items i
            JOIN app_romaneios r ON i.romaneio_id = r.id
            WHERE i.codigo_produto LIKE ? OR i.descricao_produto LIKE ?
            ORDER BY r.data_liberacao DESC
            LIMIT 50
        `;
        const param = `%${q}%`;
        const [rows] = await mysqlPool.execute(query, [param, param]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
