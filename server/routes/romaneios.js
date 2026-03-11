const express = require('express');
const router = express.Router();
const db = require('../db'); // Postgres
const mysqlPool = require('../services/mysqlService'); // MySQL
const { requirePermission } = require('../middlewares/rbac');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// --- Multer disk storage for Romaneio photos ---
const uploadsDir = path.join(__dirname, '..', 'uploads', 'romaneios');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const uniqueName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per photo
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        cb(null, allowed.test(ext));
    }
});

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

        // Tabela de Recebimentos Parciais
        try {
            await conn.execute(`
                CREATE TABLE IF NOT EXISTS app_romaneio_recebimentos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    romaneio_id INT NOT NULL,
                    romaneio_item_id INT NOT NULL,
                    quantidade DECIMAL(15,2) NOT NULL,
                    data_recebimento DATETIME DEFAULT CURRENT_TIMESTAMP,
                    usuario VARCHAR(100),
                    observacao TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_item (romaneio_item_id)
                )
            `);
            
            // Garantir colunas se a tabela já existia
            try { await conn.execute("ALTER TABLE app_romaneio_recebimentos ADD COLUMN romaneio_id INT NOT NULL AFTER id"); } catch(e){}
            try { await conn.execute("ALTER TABLE app_romaneio_recebimentos ADD COLUMN romaneio_item_id INT NOT NULL AFTER romaneio_id"); } catch(e){}
            try { await conn.execute("ALTER TABLE app_romaneio_recebimentos ADD INDEX idx_romaneio (romaneio_id)"); } catch(e){}
            try { await conn.execute("ALTER TABLE app_romaneio_recebimentos ADD INDEX idx_item (romaneio_item_id)"); } catch(e){}

            console.log('✅ [Romaneios] Tabela app_romaneio_recebimentos verificada/criada.');
        } catch (e) {
            console.error('⚠️ [Romaneios] Erro app_romaneio_recebimentos:', e.message);
        }

        // Coluna fotos (TEXT — compatível com MySQL 5.6 que não suporta JSON nativo)
        try {
            await conn.execute("ALTER TABLE app_romaneios ADD COLUMN fotos TEXT NULL");
            console.log('✅ [Romaneios] Coluna fotos criada.');
        } catch (e) {
            if (e.errno !== 1060) console.error('⚠️ [Romaneios] Erro fotos column:', e.message);
        }

        // Coluna current_revision
        try {
            await conn.execute("ALTER TABLE app_romaneios ADD COLUMN current_revision INT DEFAULT 1");
            console.log('✅ [Romaneios] Coluna current_revision criada.');
        } catch (e) {
            if (e.errno !== 1060) console.error('⚠️ [Romaneios] Erro current_revision:', e.message);
        }

        // Tabela de Revisões
        try {
            await conn.execute(`
                CREATE TABLE IF NOT EXISTS app_romaneio_revisions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    romaneio_id INT NOT NULL,
                    revision_number INT NOT NULL,
                    snapshot_data MEDIUMTEXT NOT NULL,
                    reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_romaneio_rev (romaneio_id)
                )
            `);
            console.log('✅ [Romaneios] Tabela app_romaneio_revisions verificada/criada.');
        } catch (e) {
            console.error('⚠️ [Romaneios] Erro app_romaneio_revisions:', e.message);
        }

        conn.release();
    } catch (err) {
        console.error('⚠️ [Romaneios] Falha geral na migração:', err.message);
    }
})();

// Endpoint de Upload de Foto
router.post('/upload-photo', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem recebida.' });
        const url = `/uploads/romaneios/${req.file.filename}`;
        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Criar Romaneio (Cabeçalho)
router.post('/', requirePermission('romaneios', 'create'), async (req, res) => {
    try {
        const {
            cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
            cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
            motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
            usuario, data_liberacao, data_previsao_retorno, fotos
        } = req.body;

        const [result] = await mysqlPool.execute(
            `INSERT INTO app_romaneios (
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
                usuario, data_liberacao, data_previsao_retorno, fotos
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade || null, veiculo_modelo, veiculo_placa,
                usuario || 'Sistema',
                data_liberacao || new Date(),
                data_previsao_retorno || null,
                fotos ? (typeof fotos === 'string' ? fotos : JSON.stringify(fotos)) : null
            ]
        );

        res.json({ id: result.insertId, message: 'Romaneio criado com sucesso!' });
    } catch (err) {
        console.error('Erro ao criar romaneio:', err);
        res.status(500).json({ error: err.message });
    }
});

// Atualizar Romaneio (Cabeçalho)
router.put('/:id', requirePermission('romaneios', 'edit'), async (req, res) => {
    try {
        const {
            cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
            cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
            motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
            data_liberacao, data_previsao_retorno, fotos
        } = req.body;

        await mysqlPool.execute(
            `UPDATE app_romaneios SET
                cliente_cod=?, cliente_loja=?, cliente_nome=?, tipo_id=?, observacao_geral=?,
                cliente_endereco=?, cliente_bairro=?, cliente_cidade=?, cliente_uf=?, cliente_cep=?, cliente_telefone=?,
                motorista_nome=?, motorista_cnh=?, motorista_cnh_validade=?, veiculo_modelo=?, veiculo_placa=?,
                data_liberacao=?, data_previsao_retorno=?, fotos=?
             WHERE id = ?`,
            [
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade || null, veiculo_modelo, veiculo_placa,
                data_liberacao, data_previsao_retorno || null,
                fotos ? (typeof fotos === 'string' ? fotos : JSON.stringify(fotos)) : null,
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
            SELECT r.*, t.description as tipo_descricao,
                (SELECT COALESCE(SUM(quantidade), 0) FROM app_romaneio_items WHERE romaneio_id = r.id) as total_enviado,
                (SELECT COALESCE(SUM(quantidade), 0) FROM app_romaneio_recebimentos WHERE romaneio_id = r.id) as total_recebido
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
            SELECT i.*, d.peso_kg, d.area_pintura_m2,
                (SELECT COALESCE(SUM(quantidade), 0) FROM app_romaneio_recebimentos WHERE romaneio_item_id = i.id) as qtd_recebida
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
router.post('/:id/items', requirePermission('romaneios', 'edit'), async (req, res) => {
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
router.put('/:id/status', requirePermission('romaneios', 'edit'), async (req, res) => {
    try {
        const { status } = req.body;
        await mysqlPool.execute('UPDATE app_romaneios SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status atualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- RECEBIMENTOS PARCIAIS: ESPECÍFICAS ANTES DAS GENÉRICAS ---
// 4. Deletar um recebimento específico (Movido para cá para não cair no router.delete('/:id'))
router.delete('/recebimentos/:id', requirePermission('recebimentos', 'delete'), async (req, res) => {
    try {
        const recebimentoId = req.params.id;

        const [result] = await mysqlPool.execute('DELETE FROM app_romaneio_recebimentos WHERE id = ?', [recebimentoId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Recebimento não encontrado' });
        }

        res.json({ message: 'Recebimento excluído com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deletar Romaneio (com cascade)
router.delete('/:id', requirePermission('romaneios', 'delete'), async (req, res) => {
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();
        const id = req.params.id;
        await conn.execute('DELETE FROM app_romaneio_recebimentos WHERE romaneio_id = ?', [id]);
        await conn.execute('DELETE FROM app_romaneio_revisions WHERE romaneio_id = ?', [id]);
        await conn.execute('DELETE FROM app_romaneio_items WHERE romaneio_id = ?', [id]);
        await conn.execute('DELETE FROM app_romaneios WHERE id = ?', [id]);
        await conn.commit();
        res.json({ message: 'Romaneio excluído com sucesso' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// --- ITENS ---
// Editar Item
router.put('/:id/items/:itemId', requirePermission('romaneios', 'edit'), async (req, res) => {
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
router.delete('/:id/items/:itemId', requirePermission('romaneios', 'edit'), async (req, res) => {
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
router.post('/:id/revisions', requirePermission('romaneios', 'edit'), async (req, res) => {
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

// --- RECEBIMENTOS PARCIAIS ---

// 1. Listar itens de romaneios com saldo pendente ou já recebido (Filtros avançados)
router.get('/recebimentos/pendentes', async (req, res) => {
    try {
        const { search, fornecedor, romaneioId, viewMode, tipoRomaneio } = req.query;
        // viewMode: 'pendentes' ou 'todos'

        let query = `
            SELECT 
                i.id as item_id, i.romaneio_id, i.codigo_produto, i.descricao_produto, 
                i.quantidade as quantidade_enviada, i.pedido, i.item_pedido,
                r.cliente_nome as fornecedor_nome, r.cliente_cod as fornecedor_cod, r.data_liberacao, r.status as romaneio_status,
                r.data_previsao_retorno, t.description as romaneio_tipo, t.id as tipo_id,
                COALESCE(SUM(rec.quantidade), 0) as quantidade_recebida,
                (i.quantidade - COALESCE(SUM(rec.quantidade), 0)) as saldo_pendente,
                MAX(rec.data_recebimento) as data_ultimo_recebimento,
                SUBSTRING_INDEX(GROUP_CONCAT(rec.usuario ORDER BY rec.data_recebimento DESC SEPARATOR '|'), '|', 1) as ultimo_usuario
            FROM app_romaneio_items i
            JOIN app_romaneios r ON i.romaneio_id = r.id
            LEFT JOIN app_romaneio_types t ON r.tipo_id = t.id
            LEFT JOIN app_romaneio_recebimentos rec ON i.id = rec.romaneio_item_id
            WHERE 1=1
        `;

        const params = [];

        if (search) {
            query += ` AND (i.codigo_produto LIKE ? OR i.descricao_produto LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (fornecedor) {
            query += ` AND (r.cliente_nome LIKE ? OR r.cliente_cod LIKE ?)`;
            params.push(`%${fornecedor}%`, `%${fornecedor}%`);
        }

        if (romaneioId) {
            query += ` AND r.id = ?`;
            params.push(romaneioId);
        }

        if (tipoRomaneio) {
            query += ` AND r.tipo_id = ?`;
            params.push(tipoRomaneio);
        }

        query += ` GROUP BY i.id, i.romaneio_id, i.codigo_produto, i.descricao_produto, i.quantidade, i.pedido, i.item_pedido, r.cliente_nome, r.cliente_cod, r.data_liberacao, r.status, r.data_previsao_retorno, t.description, t.id`;

        // Having clause para filtrar pelo saldo
        if (viewMode === 'pendentes' || !viewMode) {
            query += ` HAVING saldo_pendente > 0`;
        }

        query += ` ORDER BY r.data_liberacao DESC LIMIT 500`;

        const [rows] = await mysqlPool.execute(query, params);

        // ENRICHMENT: Docs (from MySQL) and OP (from PostgreSQL)
        if (rows.length > 0) {
            const productCodes = [...new Set(rows.map(r => r.codigo_produto).filter(c => c))];

            // Fetch Docs
            let docsMap = {};
            if (productCodes.length > 0) {
                const CHUNK_SIZE = 100;
                for (let i = 0; i < productCodes.length; i += CHUNK_SIZE) {
                    const chunk = productCodes.slice(i, i + CHUNK_SIZE);
                    const placeholders = chunk.map(() => '?').join(',');
                    const [docsRows] = await mysqlPool.execute(
                        `SELECT DISTINCT TRIM(produto_codigo) as produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
                        chunk
                    );
                    docsRows.forEach(row => {
                        if (!docsMap[row.produto_codigo]) docsMap[row.produto_codigo] = [];
                        docsMap[row.produto_codigo].push(row);
                    });
                }
            }

            // Fetch OP from Postgres
            const orderPairs = rows.map(r => ({ pedido: String(r.pedido || '').trim(), item: String(r.item_pedido || '').trim() }))
                .filter(p => p.pedido && p.item);

            let pgMap = {};
            if (orderPairs.length > 0) {
                try {
                    // Create parameterized tuples string for Postgres IN clause
                    const tupleValues = orderPairs.map((_, i) => `($${(i * 2) + 1}, $${(i * 2) + 2})`).join(', ');
                    const pgParams = orderPairs.flatMap(p => [p.pedido, p.item]);
                    const pgQuery = `
                        SELECT TRIM(c2_pedido) as pedido, TRIM(c2_itempv) as item, TRIM(c2_num) as op_num, TRIM(c2_obs) as obs
                        FROM public.sc2010 
                        WHERE (
                          (TRIM(c2_pedido), TRIM(c2_itempv)) IN (${tupleValues})
                          OR (TRIM(COALESCE(c2_pedido, '')) = '' AND (TRIM(c2_obs), TRIM(c2_itempv)) IN (${tupleValues}))
                        )
                        AND COALESCE(d_e_l_e_t_, '') = ''
                    `;
                    const pgResult = await db.query(pgQuery, pgParams);
                    pgResult.rows.forEach(r => {
                        const pedidoKey = (r.pedido || (r.obs ? (r.obs.match(/^\d+/)?.[0] || '') : '')).trim();
                        if (pedidoKey) {
                            pgMap[`${pedidoKey}-${r.item}`] = r.op_num;
                        }
                    });
                } catch (pgErr) {
                    console.error('Erro ao buscar OP no Postgres:', pgErr.message);
                }
            }

            // Map data back to rows
            rows.forEach(row => {
                // Attach Docs
                const docs = docsMap[row.codigo_produto] || [];
                row.has_docs = docs.length > 0;
                row.docs_count = docs.length;
                const drawing = docs.find(d => String(d.tipo).toLowerCase().includes('desenho'));
                row.has_drawing = !!drawing;
                row.drawing_url = drawing ? drawing.url_arquivo : null;
                row.first_doc = docs.length > 0 ? docs[0].url_arquivo : null;

                // Attach OP
                if (row.pedido && row.item_pedido) {
                    const op = pgMap[`${String(row.pedido).trim()}-${String(row.item_pedido).trim()}`];
                    row.op_num = op || null;
                }
            });
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Registrar um recebimento para um item
router.post('/items/:itemId/receber', requirePermission('recebimentos', 'create'), async (req, res) => {
    try {
        const { romaneio_id, quantidade, usuario, observacao, data_recebimento } = req.body;
        const romaneio_item_id = req.params.itemId;

        if (!quantidade || quantidade <= 0) {
            return res.status(400).json({ error: 'Quantidade inválida' });
        }

        let dataFormatada = data_recebimento || new Date();
        if (typeof dataFormatada === 'string' && dataFormatada.includes('T')) {
            dataFormatada = dataFormatada.replace('T', ' ') + (dataFormatada.length === 16 ? ':00' : '');
        }

        await mysqlPool.execute(
            `INSERT INTO app_romaneio_recebimentos
                            (romaneio_id, romaneio_item_id, quantidade, usuario, observacao, data_recebimento)
                        VALUES(?, ?, ?, ?, ?, ?)`,
            [
                romaneio_id,
                romaneio_item_id,
                quantidade,
                usuario || 'Sistema',
                observacao || '',
                dataFormatada
            ]
        );

        res.json({ message: 'Recebimento registrado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Histórico de recebimentos de um item
router.get('/items/:itemId/historico', async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute(
            `SELECT * FROM app_romaneio_recebimentos 
             WHERE romaneio_item_id = ?
                            ORDER BY data_recebimento DESC, created_at DESC`,
            [req.params.itemId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



module.exports = router;
