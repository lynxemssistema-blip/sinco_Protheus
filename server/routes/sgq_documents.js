const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// Ensure the table exists on first load
// Note: We're using MySQL syntax now.
const createDocsTableQuery = `
    CREATE TABLE IF NOT EXISTS sgq_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        sector VARCHAR(255),
        code VARCHAR(50),
        version VARCHAR(20),
        content LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
`;

const createSectorsTableQuery = `
    CREATE TABLE IF NOT EXISTS sgq_sectors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        position INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`;

const defaultSectors = ['Geral', 'Administrativo', 'Almoxarifado', 'Comercial', 'Engenharia', 'Produção', 'PCP', 'Qualidade', 'RH'];

async function initTables() {
    try {
        await mysqlPool.query(createDocsTableQuery);
        await mysqlPool.query(createSectorsTableQuery);
        
        // Verifica e adiciona a coluna deleted_at na tabela sgq_documents caso não exista
        const [columns] = await mysqlPool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'sgq_documents' 
              AND COLUMN_NAME = 'deleted_at'
        `);
        if (columns.length === 0) {
            await mysqlPool.query('ALTER TABLE sgq_documents ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
            console.log('✅ Coluna "deleted_at" adicionada à tabela sgq_documents para Soft Delete.');
        }

        // Cria a tabela de log de auditoria do SGQ
        const createAuditLogTableQuery = `
            CREATE TABLE IF NOT EXISTS app_sgq_audit_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                table_name VARCHAR(100) NOT NULL,
                action VARCHAR(20) NOT NULL,
                record_id INT NOT NULL,
                old_values LONGTEXT,
                new_values LONGTEXT,
                user_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await mysqlPool.query(createAuditLogTableQuery);

        // Cria a tabela de Ação Corretiva/Preventiva (CAPA) relacionada a RNCs
        const createCapaTableQuery = `
            CREATE TABLE IF NOT EXISTS app_sgq_capa (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rnc_id INT,
                descricao TEXT NOT NULL,
                analise_causa_raiz TEXT,
                plano_acao TEXT NOT NULL,
                responsavel VARCHAR(100),
                data_limite DATE,
                avaliacao_eficacia TEXT,
                status VARCHAR(50) DEFAULT 'ABERTO',
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (rnc_id) REFERENCES app_sgq_rncs(id) ON DELETE CASCADE
            )
        `;
        await mysqlPool.query(createCapaTableQuery);

        // Criação de Triggers de Auditoria para sgq_documents (usando CONCAT para compatibilidade)
        await mysqlPool.query('DROP TRIGGER IF EXISTS after_sgq_documents_insert');
        await mysqlPool.query(`
            CREATE TRIGGER after_sgq_documents_insert
            AFTER INSERT ON sgq_documents
            FOR EACH ROW
            BEGIN
                INSERT INTO app_sgq_audit_log (table_name, action, record_id, new_values)
                VALUES ('sgq_documents', 'INSERT', NEW.id, CONCAT(
                    '{"id":', NEW.id,
                    ',"title":', IF(NEW.title IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(NEW.title, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                    ',"sector":', IF(NEW.sector IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(NEW.sector, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                    ',"code":', IF(NEW.code IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(NEW.code, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                    ',"version":', IF(NEW.version IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(NEW.version, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                    '}'
                ));
            END
        `);

        await mysqlPool.query('DROP TRIGGER IF EXISTS after_sgq_documents_update');
        await mysqlPool.query(`
            CREATE TRIGGER after_sgq_documents_update
            AFTER UPDATE ON sgq_documents
            FOR EACH ROW
            BEGIN
                INSERT INTO app_sgq_audit_log (table_name, action, record_id, old_values, new_values)
                VALUES ('sgq_documents', 'UPDATE', NEW.id, 
                    CONCAT(
                        '{"id":', OLD.id,
                        ',"title":', IF(OLD.title IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(OLD.title, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                        ',"sector":', IF(OLD.sector IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(OLD.sector, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                        ',"code":', IF(OLD.code IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(OLD.code, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                        ',"version":', IF(OLD.version IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(OLD.version, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                        '}'
                    ),
                    CONCAT(
                        '{"id":', NEW.id,
                        ',"title":', IF(NEW.title IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(NEW.title, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                        ',"sector":', IF(NEW.sector IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(NEW.sector, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                        ',"code":', IF(NEW.code IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(NEW.code, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                        ',"version":', IF(NEW.version IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(NEW.version, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                        '}'
                    )
                );
            END
        `);

        await mysqlPool.query('DROP TRIGGER IF EXISTS after_sgq_documents_delete');
        await mysqlPool.query(`
            CREATE TRIGGER after_sgq_documents_delete
            AFTER DELETE ON sgq_documents
            FOR EACH ROW
            BEGIN
                INSERT INTO app_sgq_audit_log (table_name, action, record_id, old_values)
                VALUES ('sgq_documents', 'DELETE', OLD.id, CONCAT(
                    '{"id":', OLD.id,
                    ',"title":', IF(OLD.title IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(OLD.title, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                    ',"sector":', IF(OLD.sector IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(OLD.sector, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                    ',"code":', IF(OLD.code IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(OLD.code, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                    ',"version":', IF(OLD.version IS NULL, 'null', CONCAT('"', REPLACE(REPLACE(OLD.version, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"')),
                    '}'
                ));
            END
        `);

        // Seed defaults only if table is empty
        const [rows] = await mysqlPool.query('SELECT COUNT(*) as cnt FROM sgq_sectors');
        if (rows[0].cnt === 0) {
            for (let i = 0; i < defaultSectors.length; i++) {
                await mysqlPool.query(
                    'INSERT IGNORE INTO sgq_sectors (name, position) VALUES (?, ?)',
                    [defaultSectors[i], i]
                );
            }
        }
    } catch (err) {
        console.error('❌ Erro ao inicializar tabelas SGQ:', err.message);
    }
}

initTables();

// --- SECTORS ROUTES ---

// GET all sectors
router.get('/sectors', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM sgq_sectors ORDER BY position, id');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST - create or rename sector
router.post('/sectors', async (req, res) => {
    try {
        const { id, name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nome inválido.' });
        if (id) {
            await mysqlPool.query('UPDATE sgq_sectors SET name = ? WHERE id = ?', [name.trim(), id]);
            const [rows] = await mysqlPool.query('SELECT * FROM sgq_sectors WHERE id = ?', [id]);
            res.json(rows[0]);
        } else {
            const [maxPos] = await mysqlPool.query('SELECT COALESCE(MAX(position),0)+1 as pos FROM sgq_sectors');
            const [result] = await mysqlPool.query(
                'INSERT INTO sgq_sectors (name, position) VALUES (?, ?)',
                [name.trim(), maxPos[0].pos]
            );
            const [rows] = await mysqlPool.query('SELECT * FROM sgq_sectors WHERE id = ?', [result.insertId]);
            res.json(rows[0]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a sector
router.delete('/sectors/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM sgq_sectors WHERE id = ?', [req.params.id]);
        res.json({ message: 'Setor excluído.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE or UPDATE a document
router.post('/', async (req, res) => {
    try {
        const { id, title, sector, code, version, content } = req.body;

        if (id) {
            await mysqlPool.query(
                `UPDATE sgq_documents 
                 SET title = ?, sector = ?, code = ?, version = ?, content = ?
                 WHERE id = ?`,
                [title, sector, code, version, content, id]
            );

            // fetch updated record
            const [rows] = await mysqlPool.query('SELECT * FROM sgq_documents WHERE id = ?', [id]);
            res.json(rows[0]);
        } else {
            const [result] = await mysqlPool.query(
                `INSERT INTO sgq_documents (title, sector, code, version, content)
                 VALUES (?, ?, ?, ?, ?)`,
                [title, sector, code || 'POP-MF-00X', version || '01', content]
            );

            // fetch the new record
            const [rows] = await mysqlPool.query('SELECT * FROM sgq_documents WHERE id = ?', [result.insertId]);
            res.json(rows[0]);
        }
    } catch (err) {
        console.error('❌ Erro no POST sgq_documents:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET all documents summary
router.get('/', async (req, res) => {
    try {
        // Filtra para carregar apenas documentos ativos (não deletados logicamente)
        const [rows] = await mysqlPool.query(
            `SELECT id, title, sector, code, version, updated_at 
             FROM sgq_documents 
             WHERE deleted_at IS NULL 
             ORDER BY updated_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Erro no GET sgq_documents:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET specific document with content
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT * FROM sgq_documents WHERE id = ? AND deleted_at IS NULL', 
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Documento não encontrado.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('❌ Erro no GET sgq_documents/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE a document (SOFT DELETE para auditoria e controle ISO 9001)
router.delete('/:id', async (req, res) => {
    try {
        await mysqlPool.query(
            'UPDATE sgq_documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', 
            [req.params.id]
        );
        res.json({ message: 'Documento excluído logicamente (enviado para lixeira).' });
    } catch (err) {
        console.error('❌ Erro no DELETE sgq_documents:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
