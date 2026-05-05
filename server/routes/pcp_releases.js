const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const fs = require('fs');
const path = require('path');
const { validate, rules } = require('../middlewares/validate');

// Base path for saving PDFs on the network share
const OS_BASE_PATH = process.platform === 'win32'
    ? '//192.168.1.253/Estrutura Lynx/005-ORDEM DE SERVIÇO'
    : '/mnt/lynx/005-ORDEM DE SERVIÇO';

// Table Initialization — adds codigo_liberacao if table already exists
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_releases (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                codigo_liberacao    VARCHAR(20)  DEFAULT NULL,
                lote_info           VARCHAR(255) NOT NULL,
                data_pcp            VARCHAR(50)  DEFAULT NULL,
                usuario             VARCHAR(100) NOT NULL,
                qtd_ops             INT          DEFAULT 0,
                ops_json            LONGTEXT     DEFAULT NULL,
                caminho_arquivo     VARCHAR(500) DEFAULT NULL,
                data_hora           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_lote   (lote_info(64)),
                INDEX idx_data   (data_hora),
                INDEX idx_user   (usuario),
                INDEX idx_codigo (codigo_liberacao)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Safe migration: add column if it doesn't exist yet
        await mysqlPool.query(`
            ALTER TABLE app_pcp_releases 
            ADD COLUMN IF NOT EXISTS codigo_liberacao VARCHAR(20) DEFAULT NULL
        `).catch(() => {}); // some MySQL versions may not support IF NOT EXISTS on ALTER

        // Add caminho_arquivo column for existing DBs
        try {
            await mysqlPool.query(`ALTER TABLE app_pcp_releases ADD COLUMN caminho_arquivo VARCHAR(500) DEFAULT NULL`);
        } catch (e) {}

        console.log('✅ PCP Releases table initialized');
    } catch (err) {
        console.error('❌ Error initializing app_pcp_releases table:', err);
    }
})();

/**
 * Generate unique liberation code using an atomic sequence table.
 * Prevents duplicate codes under concurrent requests (race condition fix).
 * Uses SELECT MAX(seq)+1 inside a serialized transaction.
 */
const generateCodigoLiberacao = async (conn) => {
    const year = new Date().getFullYear();
    const prefix = `LPF-${year}-`;

    // Atomic: lock the table for this year's latest seq and increment
    await conn.query('LOCK TABLES app_pcp_releases WRITE');
    try {
        const [[{ maxSeq }]] = await conn.query(
            `SELECT COALESCE(MAX(
                CAST(SUBSTRING(codigo_liberacao, LENGTH(?) + 1) AS UNSIGNED)
            ), 0) AS maxSeq
            FROM app_pcp_releases
            WHERE codigo_liberacao LIKE ?`,
            [prefix, `${prefix}%`]
        );
        const seq = String(maxSeq + 1).padStart(5, '0');
        return `${prefix}${seq}`;
    } finally {
        await conn.query('UNLOCK TABLES');
    }
};

// POST /api/pcp-releases/log — Register a batch liberation
router.post('/log', validate(rules.pcpReleaseLog), async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { lote_info, data_pcp, usuario, qtd_ops, ops_json } = req.body;

        await connection.beginTransaction();

        // Atomic code generation inside the same connection (prevents race condition)
        const codigo_liberacao = await generateCodigoLiberacao(connection);

        const [result] = await connection.query(
            `INSERT INTO app_pcp_releases (codigo_liberacao, lote_info, data_pcp, usuario, qtd_ops, ops_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [codigo_liberacao, lote_info, data_pcp || null, usuario, qtd_ops || 0, ops_json || null]
        );

        if (ops_json) {
            try {
                const ops = JSON.parse(ops_json);
                for (const op of ops) {
                    if (op.is_fraction && op.fraction_id) {
                        await connection.query(
                            'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = ? WHERE id = ?',
                            [codigo_liberacao, op.fraction_id]
                        );
                    } else if (op.pedido && op.item) {
                        await connection.query(
                            'UPDATE app_sales_order_item_notes SET lpf_codigo = ? WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                            [codigo_liberacao, op.pedido.trim(), op.item.trim()]
                        );
                    }
                }
            } catch (err) {
                console.error('Error updating OPs with LPF code:', err);
            }
        }

        await connection.commit();
        console.log(`✅ Liberação PCP registrada: ${codigo_liberacao} (id=${result.insertId})`);
        res.json({ success: true, codigo_liberacao, id: result.insertId });
    } catch (err) {
        await connection.rollback();
        console.error('❌ [PCP RELEASE LOG ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// GET /api/pcp-releases/find/:codigo — Fetch single release to get PDF path
router.get('/find/:codigo', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT caminho_arquivo FROM app_pcp_releases WHERE codigo_liberacao = ?',
            [req.params.codigo]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Liberação não encontrada' });
        res.json({ success: true, caminho_arquivo: rows[0].caminho_arquivo });
    } catch (err) {
        console.error('❌ [PCP RELEASE FIND ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pcp-releases/download/:codigo — Download PDF
router.get('/download/:codigo', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT caminho_arquivo FROM app_pcp_releases WHERE codigo_liberacao = ?',
            [req.params.codigo]
        );
        if (rows.length === 0 || !rows[0].caminho_arquivo) {
            return res.status(404).json({ error: 'Arquivo não encontrado no banco' });
        }
        const filepath = rows[0].caminho_arquivo;
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Arquivo PDF não encontrado no disco' });
        }
        res.download(filepath);
    } catch (err) {
        console.error('❌ [PCP RELEASE DOWNLOAD ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pcp-releases — History with full filters
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, lote, pedido, produto, usuario, codigo } = req.query;
        const whereClauses = [];
        const params = [];

        if (startDate) {
            whereClauses.push(`data_hora >= ?`);
            params.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
            whereClauses.push(`data_hora <= ?`);
            params.push(`${endDate} 23:59:59`);
        }
        if (lote) {
            whereClauses.push(`lote_info LIKE ?`);
            params.push(`%${lote}%`);
        }
        if (usuario) {
            whereClauses.push(`usuario LIKE ?`);
            params.push(`%${usuario}%`);
        }
        if (codigo) {
            whereClauses.push(`codigo_liberacao LIKE ?`);
            params.push(`%${codigo}%`);
        }
        if (pedido) {
            whereClauses.push(`ops_json LIKE ?`);
            params.push(`%"pedido":"${pedido}%`);
        }
        if (produto) {
            whereClauses.push(`ops_json LIKE ?`);
            params.push(`%${produto}%`);
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const [rows] = await mysqlPool.query(
            `SELECT id, codigo_liberacao, lote_info, data_pcp, usuario, qtd_ops, ops_json, caminho_arquivo, data_hora
             FROM app_pcp_releases ${whereSQL}
             ORDER BY data_hora DESC LIMIT 500`,
            params
        );

        const parsed = rows.map(r => ({
            ...r,
            ops: (() => { try { return JSON.parse(r.ops_json || '[]'); } catch { return []; } })()
        }));

        res.json(parsed);
    } catch (err) {
        console.error('❌ [PCP RELEASE FETCH ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pcp-releases/save-pdf — Create folder and save PDF to network share
router.post('/save-pdf', async (req, res) => {
    try {
        const { codigo_liberacao, filename, pdfBase64 } = req.body;

        if (!codigo_liberacao || !filename || !pdfBase64) {
            return res.status(400).json({ error: 'Campos obrigatórios: codigo_liberacao, filename, pdfBase64.' });
        }

        // Sanitize folder name (remove illegal path chars)
        const safeCode = codigo_liberacao.replace(/[<>:"/\\|?*]/g, '-');
        const folderPath = path.join(OS_BASE_PATH, safeCode);

        // Create folder if it doesn't exist
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`📁 Pasta criada: ${folderPath}`);
        }

        // Write PDF file
        const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '-');
        const filePath = path.join(folderPath, safeFilename);
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        fs.writeFileSync(filePath, pdfBuffer);

        // Update database with the saved path
        await mysqlPool.query(
            `UPDATE app_pcp_releases SET caminho_arquivo = ? WHERE codigo_liberacao = ?`,
            [filePath, codigo_liberacao]
        );

        console.log(`✅ PDF salvo: ${filePath}`);
        res.json({ success: true, path: filePath });
    } catch (err) {
        console.error('❌ [SAVE PDF ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
