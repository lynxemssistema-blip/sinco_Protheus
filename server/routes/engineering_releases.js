const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { validate, rules } = require('../middlewares/validate');

// Table Initialization
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_engineering_releases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                codigo_liberacao VARCHAR(20) DEFAULT NULL,
                codigo_produto VARCHAR(50) NOT NULL,
                descricao_produto TEXT NOT NULL,
                pedido VARCHAR(30) DEFAULT NULL,
                item VARCHAR(10) DEFAULT NULL,
                usuario VARCHAR(100) NOT NULL,
                tipo_acao ENUM('DOWNLOAD', 'EMAIL') NOT NULL,
                destinatarios TEXT DEFAULT NULL,
                modo ENUM('FULL', 'N1') NOT NULL,
                caminho_arquivo VARCHAR(500) DEFAULT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cod_lib (codigo_liberacao),
                INDEX idx_prod_rel (codigo_produto),
                INDEX idx_data_rel (data_hora)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        // Add new columns to existing table
        try {
            await mysqlPool.query(`ALTER TABLE app_engineering_releases ADD COLUMN caminho_arquivo VARCHAR(500) DEFAULT NULL`);
        } catch (colErr) {}
        try {
            await mysqlPool.query(`ALTER TABLE app_engineering_releases ADD COLUMN codigo_liberacao VARCHAR(20) DEFAULT NULL`);
        } catch (colErr) {}
        console.log('✅ Engineering Releases table initialized');
    } catch (err) {
        console.error('❌ Error initializing app_engineering_releases table:', err);
    }
})();

/**
 * Generate unique liberation code for Engineering: LEN-AAAA-NNNNN
 */
const generateCodigoLiberacaoEng = async () => {
    const year = new Date().getFullYear();
    const prefix = `LEN-${year}-`;

    const [[{ total }]] = await mysqlPool.query(
        `SELECT COUNT(*) AS total FROM app_engineering_releases 
         WHERE codigo_liberacao LIKE ?`,
        [`${prefix}%`]
    );

    const seq = String(total + 1).padStart(5, '0');
    return `${prefix}${seq}`;
};

// GET /api/engineering-releases/next-code - Get the internal sequential code
router.get('/next-code', async (req, res) => {
    try {
        const nextCode = await generateCodigoLiberacaoEng();
        res.json({ nextCode });
    } catch (err) {
        console.error('❌ [NEXT CODE ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/engineering-releases/log - Register a new release action
router.post('/log', validate(rules.engineeringReleaseLog), async (req, res) => {
    try {
        const {
            codigo_produto,
            descricao_produto,
            pedido,
            item,
            usuario,
            tipo_acao,
            destinatarios,
            modo,
            caminho_arquivo,
            codigo_liberacao
        } = req.body;

        if (!codigo_produto || !usuario || !tipo_acao || !modo) {
            return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
        }

        await mysqlPool.query(
            `INSERT INTO app_engineering_releases 
             (codigo_liberacao, codigo_produto, descricao_produto, pedido, item, usuario, tipo_acao, destinatarios, modo, caminho_arquivo) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [codigo_liberacao || null, codigo_produto, descricao_produto, pedido || null, item || null, usuario, tipo_acao, destinatarios || null, modo, caminho_arquivo || null]
        );

        if (tipo_acao === 'EMAIL') {
            try {
                // Get previous state
                const [prevRows] = await mysqlPool.query('SELECT estado FROM app_produto_estados WHERE codigo_produto = ?', [codigo_produto]);
                const estado_anterior = prevRows.length > 0 ? prevRows[0].estado : 'NORMAL';

                if (estado_anterior !== 'NORMAL') {
                    // Update state to NORMAL
                    await mysqlPool.query(`
                        INSERT INTO app_produto_estados (codigo_produto, estado, updated_by) 
                        VALUES (?, 'NORMAL', ?)
                        ON DUPLICATE KEY UPDATE estado = 'NORMAL', updated_by = ?
                    `, [codigo_produto, usuario, usuario]);

                    // Insert into history
                    await mysqlPool.query(`
                        INSERT INTO app_produto_estados_historico (codigo_produto, estado_anterior, estado_novo, acao, usuario)
                        VALUES (?, ?, 'NORMAL', 'LIBERACAO_ENGENHARIA', ?)
                    `, [codigo_produto, estado_anterior, usuario]);
                    
                    console.log(`✅ [PRODUCT STATUS] Status reset to NORMAL for ${codigo_produto} via LIBERACAO_ENGENHARIA`);
                }
            } catch (statusErr) {
                console.error('❌ Error updating product status on engineering release:', statusErr);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('❌ [LOG ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/engineering-releases/log-batch - Register a batch release (one record per pedido/item)
// All records share the same codigo_liberacao for full traceability of the batch.
router.post('/log-batch', async (req, res) => {
    try {
        const {
            codigo_produto,
            descricao_produto,
            usuario,
            tipo_acao,
            modo,
            caminho_arquivo,
            codigo_liberacao,
            destinatarios,
            itens // array of { pedido, item }
        } = req.body;

        if (!codigo_produto || !usuario || !tipo_acao || !modo) {
            return res.status(400).json({ error: 'Campos obrigatórios ausentes (codigo_produto, usuario, tipo_acao, modo).' });
        }
        if (!Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ error: 'Campo "itens" deve ser um array com ao menos 1 item.' });
        }

        // Resolve the LEN code: use the provided one or generate a new one
        const codigoLib = codigo_liberacao || await generateCodigoLiberacaoEng();

        // Build multi-row INSERT values — one row per (pedido/item) pair
        const values = itens.map(i => [
            codigoLib,
            codigo_produto,
            descricao_produto || codigo_produto,
            (i.pedido || '').trim() || null,
            (i.item   || '').trim() || null,
            usuario,
            tipo_acao,
            (i.destinatarios || destinatarios || null), // per-item override or global fallback
            modo,
            caminho_arquivo || null
        ]);

        // Insert all rows in a single query for atomicity
        await mysqlPool.query(
            `INSERT INTO app_engineering_releases 
             (codigo_liberacao, codigo_produto, descricao_produto, pedido, item, usuario, tipo_acao, destinatarios, modo, caminho_arquivo)
             VALUES ?`,
            [values]
        );

        if (tipo_acao === 'EMAIL') {
            try {
                // Get previous state
                const [prevRows] = await mysqlPool.query('SELECT estado FROM app_produto_estados WHERE codigo_produto = ?', [codigo_produto]);
                const estado_anterior = prevRows.length > 0 ? prevRows[0].estado : 'NORMAL';

                if (estado_anterior !== 'NORMAL') {
                    // Update state to NORMAL
                    await mysqlPool.query(`
                        INSERT INTO app_produto_estados (codigo_produto, estado, updated_by) 
                        VALUES (?, 'NORMAL', ?)
                        ON DUPLICATE KEY UPDATE estado = 'NORMAL', updated_by = ?
                    `, [codigo_produto, usuario, usuario]);

                    // Insert into history
                    await mysqlPool.query(`
                        INSERT INTO app_produto_estados_historico (codigo_produto, estado_anterior, estado_novo, acao, usuario)
                        VALUES (?, ?, 'NORMAL', 'LIBERACAO_ENGENHARIA', ?)
                    `, [codigo_produto, estado_anterior, usuario]);
                    
                    console.log(`✅ [PRODUCT STATUS] Status reset to NORMAL for ${codigo_produto} via LIBERACAO_ENGENHARIA (BATCH)`);
                }
            } catch (statusErr) {
                console.error('❌ Error updating product status on engineering batch release:', statusErr);
            }
        }

        console.log(`✅ [LOG-BATCH] LEN=${codigoLib} | produto=${codigo_produto} | ${itens.length} registros inseridos`);
        res.json({ success: true, codigo_liberacao: codigoLib, total_registros: itens.length });
    } catch (err) {
        console.error('❌ [LOG-BATCH ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/engineering-releases/save-network - Save PDF to network folder and uploads
router.post('/save-network', upload.single('pdf'), async (req, res) => {
    try {
        const { codigo_produto, codigo_liberacao: providedCode } = req.body;
        if (!req.file || !codigo_produto) {
            return res.status(400).json({ error: 'Faltando arquivo ou código do produto.' });
        }

        const codigo_liberacao = providedCode || await generateCodigoLiberacaoEng();
        const safeCode = codigo_liberacao.replace(/[<>:"/\\|?*]/g, '-');
        const folderName = safeCode;
        const cleanCodigo = codigo_produto.replace(/[^a-zA-Z0-9_-]/g, '');
        const fileName = req.file.originalname || `${cleanCodigo}_Estrutura.pdf`;

        // 1. Salva sempre no diretório server/uploads/engineering para disponibilidade global em nuvem
        const uploadsTargetDir = path.join(__dirname, '../uploads/engineering', folderName);
        if (!fs.existsSync(uploadsTargetDir)) {
            fs.mkdirSync(uploadsTargetDir, { recursive: true });
        }
        const uploadsTargetPath = path.join(uploadsTargetDir, fileName);
        fs.writeFileSync(uploadsTargetPath, req.file.buffer);

        // 2. Salva na rede interna se disponível
        let finalPath = uploadsTargetPath;
        try {
            const baseLynx = process.platform === 'win32' ? '//192.168.1.253/Estrutura Lynx' : '/mnt/lynx';
            const targetDir = path.join(baseLynx, '000-PRODUTOS', folderName);
            if (fs.existsSync(baseLynx)) {
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                const targetPath = path.join(targetDir, fileName);
                fs.writeFileSync(targetPath, req.file.buffer);
                finalPath = targetPath;
            }
        } catch (netErr) {
            console.warn('⚠️ [SAVE NETWORK] Compartilhamento de rede indisponível, salvo em uploads:', netErr.message);
        }

        res.json({ success: true, path: finalPath, uploadsPath: uploadsTargetPath, codigo_liberacao });
    } catch (err) {
        console.error('❌ [SAVE NETWORK ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/engineering-releases - Get history with optional filters
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, product, user, pedido, item } = req.query;
        let whereClauses = [];
        let params = [];

        if (startDate) {
            whereClauses.push(`data_hora >= ?`);
            params.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
            whereClauses.push(`data_hora <= ?`);
            params.push(`${endDate} 23:59:59`);
        }
        if (product) {
            whereClauses.push(`codigo_produto LIKE ?`);
            params.push(`%${product}%`);
        }
        if (user) {
            whereClauses.push(`usuario LIKE ?`);
            params.push(`%${user}%`);
        }
        if (pedido) {
            whereClauses.push(`pedido = ?`);
            params.push(String(pedido).trim().padStart(6, '0'));
        }
        if (item) {
            whereClauses.push(`item LIKE ?`);
            params.push(`%${item}%`);
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const [rows] = await mysqlPool.query(
            `SELECT * FROM app_engineering_releases ${whereSQL} ORDER BY data_hora DESC LIMIT 1000`,
            params
        );

        res.json(rows);
    } catch (err) {
        console.error('❌ [FETCH ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
