const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// --- Multer disk storage for media uploads ---
const uploadsDir = path.join(__dirname, '..', 'uploads', 'avisos');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.bin';
        const uniqueName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|mp3|ogg|webm|wav|m4a|pdf|doc|docx|xls|xlsx|txt|zip/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        cb(null, allowed.test(ext));
    }
});

// --- Database init ---
const initDB = async () => {
    try {
        // Create sistema_avisos table first (no FK so it never fails on missing refs)
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS sistema_avisos (
                idAviso INT AUTO_INCREMENT PRIMARY KEY,
                idRemetente INT UNSIGNED NOT NULL,
                idDestinatario INT UNSIGNED DEFAULT NULL,
                mensagem TEXT,
                lido TINYINT(1) DEFAULT 0,
                concluido TINYINT(1) DEFAULT 0,
                data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_conclusao DATETIME DEFAULT NULL,
                idRespostaDe INT DEFAULT NULL
            )
        `);

        // Create grupos tables (no FK constraints to avoid type mismatch issues)
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS sistema_avisos_grupos (
                idGrupo INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                descricao TEXT,
                fotoGrupo VARCHAR(255),
                idCriador INT UNSIGNED NOT NULL,
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS sistema_avisos_grupos_membros (
                idGrupo INT NOT NULL,
                idUsuario INT UNSIGNED NOT NULL,
                data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (idGrupo, idUsuario)
            )
        `);

        // Add optional columns if missing
        const [columns] = await mysqlPool.query('SHOW COLUMNS FROM sistema_avisos');
        const colNames = columns.map(c => c.Field);

        const addCol = async (col, def) => {
            if (!colNames.includes(col)) {
                try { await mysqlPool.query(`ALTER TABLE sistema_avisos ADD COLUMN ${col} ${def}`); } catch (_) {}
            }
        };

        await addCol('idGrupo', 'INT DEFAULT NULL AFTER idDestinatario');
        await addCol('tipo_midia', "ENUM('text','image','audio','file') DEFAULT 'text' AFTER mensagem");
        await addCol('midia_url', 'VARCHAR(500) DEFAULT NULL AFTER tipo_midia');
        await addCol('midia_nome', 'VARCHAR(255) DEFAULT NULL AFTER midia_url');

        // Create performance indexes (IF NOT EXISTS pattern via try/catch on ER_DUP_KEYNAME)
        const createIndex = async (table, name, cols) => {
            try {
                await mysqlPool.query(`ALTER TABLE ${table} ADD INDEX ${name} (${cols})`);
                console.log(`  ✅ Índice ${name} criado em ${table}`);
            } catch (e) {
                if (e.code !== 'ER_DUP_KEYNAME') {
                    console.warn(`  ⚠️ Índice ${name}: ${e.message}`);
                }
            }
        };

        // Critical: eliminates full scan on every polling interval (every 30s per user)
        await createIndex('sistema_avisos', 'idx_avisos_dest_concluido', 'idDestinatario, concluido');
        // Critical: eliminates full scan on group membership sub-queries
        await createIndex('sistema_avisos_grupos_membros', 'idx_membros_usuario', 'idUsuario');

        console.log('✅ Tabelas de avisos verificadas/atualizadas.');
    } catch (e) {
        console.error('❌ Erro ao inicializar tabelas de avisos:', e.message);
    }
};

initDB();

// ========== UPLOAD ENDPOINT ==========
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo recebido.' });
        }

        const file = req.file;
        const ext = path.extname(file.originalname).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const audioExts = ['.mp3', '.ogg', '.webm', '.wav', '.m4a'];

        let tipo_midia = 'file';
        if (imageExts.includes(ext)) tipo_midia = 'image';
        else if (audioExts.includes(ext)) tipo_midia = 'audio';

        const midia_url = `/uploads/avisos/${file.filename}`;

        res.json({
            url: midia_url,
            tipo_midia,
            nome_original: file.originalname,
            tamanho: file.size
        });
    } catch (error) {
        console.error('Erro no upload:', error);
        res.status(500).json({ error: 'Erro ao processar upload' });
    }
});

// 1. Enviar nova mensagem (Usuário ou Grupo) — agora com mídia
router.post('/', async (req, res) => {
    try {
        const { idRemetente, idDestinatario, idGrupo, mensagem, idRespostaDe, tipo_midia, midia_url, midia_nome } = req.body;

        if (!idRemetente || (!idDestinatario && !idGrupo)) {
            return res.status(400).json({ error: 'Remetente, destinatário/grupo são obrigatórios.' });
        }

        // Texto ou mídia deve existir
        if (!mensagem && !midia_url) {
            return res.status(400).json({ error: 'Mensagem ou mídia é obrigatória.' });
        }

        const [result] = await mysqlPool.query(
            `INSERT INTO sistema_avisos (idRemetente, idDestinatario, idGrupo, mensagem, idRespostaDe, tipo_midia, midia_url, midia_nome) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [idRemetente, idDestinatario || null, idGrupo || null, mensagem || '', idRespostaDe || null,
                tipo_midia || 'text', midia_url || null, midia_nome || null]
        );

        // Socket.io broadcast
        const io = req.app.get('io');
        if (io) {
            const queryData = `
                SELECT a.*, ur.NomeCompleto as nomeRemetente, ur.fotoUsuario as fotoRemetente 
                FROM sistema_avisos a
                JOIN usuario ur ON a.idRemetente = ur.idUsuario
                WHERE a.idAviso = ?
            `;
            const [rows] = await mysqlPool.query(queryData, [result.insertId]);
            if (rows.length > 0) {
                const novoAviso = rows[0];
                if (idGrupo) {
                    io.to(`grupo_${idGrupo}`).emit('novo_aviso', novoAviso);
                } else {
                    io.to(`usuario_${idDestinatario}`).emit('novo_aviso', novoAviso);
                }
            }
        }

        res.status(201).json({ success: true, idAviso: result.insertId });
    } catch (error) {
        console.error('Erro ao enviar aviso:', error);
        res.status(500).json({ error: 'Erro ao enviar aviso' });
    }
});

// 2. Buscar avisos não concluídos (popups) — somente mensagens diretas (idGrupo IS NULL).
// idGrupo é garantida por initDB() — sem checagem dinâmica de esquema na hot path.
router.get('/nao-concluidos/:idUsuario', async (req, res) => {
    try {
        const { idUsuario } = req.params;

        // idx_avisos_dest_concluido (idDestinatario, concluido) garante range scan aqui
        const query = `
            SELECT a.*, ur.NomeCompleto as nomeRemetente, ur.fotoUsuario as fotoRemetente
            FROM sistema_avisos a
            JOIN usuario ur ON a.idRemetente = ur.idUsuario
            WHERE a.idDestinatario = ? AND a.concluido = 0 AND a.idGrupo IS NULL
            ORDER BY a.data_envio ASC
        `;

        // 8s hard timeout — retorna vazio em vez de pendurar o cliente por 60s.
        // Qualquer erro de MySQL (POOL_TIMEOUT, ETIMEDOUT, ECONNREFUSED, etc.)
        // é tratado como "sem avisos" para não bloquear o usuário.
        let rows;
        try {
            [rows] = await mysqlPool.query(query, [idUsuario], 8000);
        } catch (qErr) {
            console.warn(`⚠️ [Avisos] Erro MySQL para usuário ${idUsuario} (${qErr.code || qErr.message}) — retornando vazio`);
            return res.json([]);
        }

        if (rows.length > 0) {
            const ids = rows.map(r => r.idAviso);
            // Fire-and-forget: marca como lido sem bloquear a resposta
            mysqlPool.query(`UPDATE sistema_avisos SET lido = 1 WHERE idAviso IN (?)`, [ids], 5000)
                .catch(e => console.warn('⚠️ [Avisos] Falha ao marcar como lido:', e.message));
        }

        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar avisos ativos:', error);
        res.status(500).json({ error: 'Erro ao buscar avisos', details: error.message });
    }
});


// 3. Concluir um aviso
router.put('/:idAviso/concluir', async (req, res) => {
    try {
        const { idAviso } = req.params;
        await mysqlPool.query(
            'UPDATE sistema_avisos SET concluido = 1, data_conclusao = CURRENT_TIMESTAMP WHERE idAviso = ?',
            [idAviso]
        );
        res.json({ success: true, message: 'Aviso concluído.' });
    } catch (error) {
        console.error('Erro ao concluir aviso:', error);
        res.status(500).json({ error: 'Erro ao concluir aviso' });
    }
});

// 4. Histórico Completo (Mensagens diretas e Grupos)
router.get('/historico/:idUsuario', async (req, res) => {
    try {
        const { idUsuario } = req.params;
        const query = `
            SELECT a.idAviso, a.idRemetente, a.idDestinatario, a.idGrupo, a.mensagem, a.lido, a.concluido, 
                   a.data_envio, a.data_conclusao, a.idRespostaDe,
                   a.tipo_midia, a.midia_url, a.midia_nome,
                   ur.NomeCompleto as remetenteNome, 
                   ud.NomeCompleto as destinatarioNome,
                   g.nome as grupoNome
            FROM sistema_avisos a
            JOIN usuario ur ON a.idRemetente = ur.idUsuario
            LEFT JOIN usuario ud ON a.idDestinatario = ud.idUsuario
            LEFT JOIN sistema_avisos_grupos g ON a.idGrupo = g.idGrupo
            WHERE a.idRemetente = ? 
               OR a.idDestinatario = ? 
               OR a.idGrupo IN (SELECT idGrupo FROM sistema_avisos_grupos_membros WHERE idUsuario = ?)
            ORDER BY a.data_envio DESC
        `;
        const [rows] = await mysqlPool.query(query, [idUsuario, idUsuario, idUsuario]);
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico', details: error.message });
    }
});

// 5. Criar Grupo
router.post('/grupos', async (req, res) => {
    try {
        const { nome, descricao, idCriador, membros } = req.body;

        const [result] = await mysqlPool.query(
            'INSERT INTO sistema_avisos_grupos (nome, descricao, idCriador) VALUES (?, ?, ?)',
            [nome, descricao || null, idCriador]
        );

        const idGrupo = result.insertId;

        const allMembros = Array.from(new Set([idCriador, ...(membros || [])]));

        const membrosValues = allMembros.map(id => [idGrupo, id]);
        await mysqlPool.query(
            'INSERT INTO sistema_avisos_grupos_membros (idGrupo, idUsuario) VALUES ?',
            [membrosValues]
        );

        res.status(201).json({ success: true, idGrupo, nome });
    } catch (error) {
        console.error('Erro ao criar grupo:', error);
        res.status(500).json({ error: 'Erro ao criar grupo' });
    }
});

// 6. Listar Grupos do Usuário
router.get('/grupos/usuario/:idUsuario', async (req, res) => {
    try {
        const { idUsuario } = req.params;
        const query = `
            SELECT g.*, 
                   (SELECT COUNT(*) FROM sistema_avisos_grupos_membros WHERE idGrupo = g.idGrupo) as totalMembros
            FROM sistema_avisos_grupos g
            JOIN sistema_avisos_grupos_membros gm ON g.idGrupo = gm.idGrupo
            WHERE gm.idUsuario = ?
            ORDER BY g.nome ASC
        `;
        const [rows] = await mysqlPool.query(query, [idUsuario]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar grupos:', error);
        res.status(500).json({ error: 'Erro ao listar grupos' });
    }
});

// 7. Busca Global de Conteúdo
router.get('/search/conteudo', async (req, res) => {
    try {
        const { q, idUsuario } = req.query;
        if (!q || !idUsuario) return res.status(400).json({ error: 'Parâmetros insuficientes.' });

        const query = `
            SELECT a.idAviso, a.idRemetente, a.idDestinatario, a.idGrupo, a.mensagem, a.lido, a.concluido, 
                   a.data_envio, a.data_conclusao, a.idRespostaDe,
                   a.tipo_midia, a.midia_url, a.midia_nome,
                   ur.NomeCompleto as remetenteNome, 
                   ud.NomeCompleto as destinatarioNome,
                   g.nome as grupoNome
            FROM sistema_avisos a
            JOIN usuario ur ON a.idRemetente = ur.idUsuario
            LEFT JOIN usuario ud ON a.idDestinatario = ud.idUsuario
            LEFT JOIN sistema_avisos_grupos g ON a.idGrupo = g.idGrupo
            WHERE a.mensagem LIKE ?
              AND (
                a.idRemetente = ? 
                OR a.idDestinatario = ? 
                OR a.idGrupo IN (SELECT idGrupo FROM sistema_avisos_grupos_membros WHERE idUsuario = ?)
              )
            ORDER BY a.data_envio DESC
            LIMIT 50
        `;
        const [rows] = await mysqlPool.query(query, [`%${q}%`, idUsuario, idUsuario, idUsuario]);
        res.json(rows);
    } catch (error) {
        console.error('Erro na busca global:', error);
        res.status(500).json({ error: 'Erro na busca global' });
    }
});

module.exports = router;
