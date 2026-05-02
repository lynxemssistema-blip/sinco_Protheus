const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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
router.post('/log', async (req, res) => {
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

        res.json({ success: true });
    } catch (err) {
        console.error('❌ [LOG ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/engineering-releases/save-network - Save PDF to network folder
router.post('/save-network', upload.single('pdf'), async (req, res) => {
    try {
        const { codigo_produto, codigo_liberacao: providedCode } = req.body;
        if (!req.file || !codigo_produto) {
            return res.status(400).json({ error: 'Faltando arquivo ou código do produto.' });
        }

        const codigo_liberacao = providedCode || await generateCodigoLiberacaoEng();
        const safeCode = codigo_liberacao.replace(/[<>:"/\\|?*]/g, '-');
        const folderName = safeCode;
        const baseLynx = process.platform === 'win32' ? '//192.168.1.253/Estrutura Lynx' : '/mnt/lynx';
        const targetDir = path.join(baseLynx, '000-PRODUTOS', folderName);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const cleanCodigo = codigo_produto.replace(/[^a-zA-Z0-9_-]/g, '');
        const fileName = req.file.originalname || `${cleanCodigo}_Estrutura.pdf`;
        const targetPath = path.join(targetDir, fileName);

        fs.writeFileSync(targetPath, req.file.buffer);

        res.json({ success: true, path: targetPath, codigo_liberacao });
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
