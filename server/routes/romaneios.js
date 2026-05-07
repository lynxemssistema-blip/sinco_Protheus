const express = require('express');
const router = express.Router();
const db = require('../db'); // Postgres
const mysqlPool = require('../services/mysqlService'); // MySQL
const { requirePermission } = require('../middlewares/rbac');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFExtractionService = require('../services/pdfExtraction');
const { generateRomaneioBundle } = require('../services/pdfBundleService');
const crypto = require('crypto');

// --- Multer disk storage for Romaneio photos ---
const uploadsDir = path.join(__dirname, '..', 'uploads', 'romaneios');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- Migrations: garantir estrutura do BD (MySQL 5.7+) ---
(async () => {
    try {
        const connection = await mysqlPool.getConnection();

        const addColIfMissing = async (table, col, type) => {
            const [rows] = await connection.query(
                `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [table, col]
            );
            if (rows[0].cnt === 0) {
                await connection.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
                console.log(`[Romaneios] Coluna ${col} criada em ${table}.`);
            }
        };

        // app_romaneios
        await addColIfMissing('app_romaneios', 'current_revision', 'INT DEFAULT 1');
        await addColIfMissing('app_romaneios', 'usuario', 'VARCHAR(100) DEFAULT \'Sistema\'');
        await addColIfMissing('app_romaneios', 'data_previsao_retorno', 'DATE DEFAULT NULL');

        // app_romaneio_revisions
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_romaneio_revisions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                romaneio_id INT NOT NULL,
                revision_number INT NOT NULL,
                snapshot_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                usuario VARCHAR(100) DEFAULT 'Sistema',
                FOREIGN KEY (romaneio_id) REFERENCES app_romaneios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        await addColIfMissing('app_romaneio_revisions', 'usuario', 'VARCHAR(100) DEFAULT \'Sistema\'');

        // app_emails (Log de envios)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_emails (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message_id VARCHAR(255),
                folder VARCHAR(20),
                sender_name VARCHAR(255),
                sender_email VARCHAR(255),
                recipient_email TEXT,
                subject VARCHAR(255),
                body_html LONGTEXT,
                has_attachments TINYINT DEFAULT 0,
                date DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        // app_romaneio_items
        await addColIfMissing('app_romaneio_items', 'peso_unitario', 'DECIMAL(10,3) DEFAULT NULL');
        await addColIfMissing('app_romaneio_items', 'area_pintura_unitario', 'DECIMAL(10,4) DEFAULT NULL');

        connection.release();
        console.log('[Romaneios] Estrutura do banco de dados verificada/atualizada.');
    } catch (e) {
        console.warn('[Romaneios] Erro na verificação da estrutura:', e.message);
    }
})();

// --- NETWORK SHARE CONFIG (Estrutura Lynx) ---
function getRomaneioBaseDir() {
    if (process.env.ROMANEIOS_NETWORK_DIR) return process.env.ROMANEIOS_NETWORK_DIR;
    if (process.platform === 'win32') return '//192.168.1.253/Estrutura Lynx/007-ROMANEIO';
    return '/mnt/lynx/007-ROMANEIO';
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
                a2.A2_COD as codigo, 
                a2.A2_LOJA as loja, 
                a2.A2_NOME as nome, 
                a2.A2_NREDUZ as nreduz,
                a2.A2_CGC as cnpj,
                a2.A2_EST as uf,
                a2.A2_MUN as cidade,
                a2.A2_TIPO as tipo,
                a2.A2_END as endereco,
                a2.A2_BAIRRO as bairro,
                a2.A2_CEP as cep,
                a2.A2_TEL as telefone,
                a2.A2_EMAIL as email
            FROM public.sa2010 a2
            WHERE COALESCE(a2.D_E_L_E_T_, '') IN ('', ' ')
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

        query += ` ORDER BY a2.a2_nome ASC LIMIT 2000`;
        
        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar Todo o Histórico de Status (Para Relatório de Engenharia)
// MANTIDO NO TOPO para evitar conflito com /:id
router.get('/revisions/all', requirePermission('romaneios', 'read'), async (req, res) => {
    try {
        const { startDate, endDate, search } = req.query;
        let query = `
            SELECT rev.id, rev.romaneio_id, rev.revision_number, rev.reason, rev.usuario, rev.created_at,
                   rom.cliente_nome, rom.status as current_status
            FROM app_romaneio_revisions rev
            JOIN app_romaneios rom ON rev.romaneio_id = rom.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) { query += " AND rev.created_at >= ?"; params.push(startDate); }
        if (endDate) { query += " AND rev.created_at <= ?"; params.push(endDate); }
        if (search) {
            query += " AND (rom.cliente_nome LIKE ? OR rom.id LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        query += " ORDER BY rev.created_at DESC LIMIT 500";
        const [rows] = await mysqlPool.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- VERIFICAÇÃO DE OP ITEM ---

// --- VERIFICAÇÃO DE OP ITEM ---
router.get('/check-op-item', async (req, res) => {
    try {
        const { op, item } = req.query;
        if (!op || !item) {
            return res.status(400).json({ error: 'Parâmetros op e item são obrigatórios' });
        }

        const query = `
            SELECT 
                r.id AS romaneio_id,
                r.status,
                r.data_liberacao as data_criacao,
                i.quantidade as qtd_enviada
            FROM app_romaneio_items i
            JOIN app_romaneios r ON i.romaneio_id = r.id
            WHERE i.pedido = ? AND i.item_pedido = ?
            ORDER BY r.data_liberacao DESC
        `;

        const [rows] = await mysqlPool.execute(query, [op, item]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao verificar OP item:', err);
        res.status(500).json({ error: 'Erro ao verificar OP item' });
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

        // Coluna diretorio_rede
        try {
            await conn.execute("ALTER TABLE app_romaneios ADD COLUMN diretorio_rede VARCHAR(500) NULL");
            console.log('✅ [Romaneios] Coluna diretorio_rede criada.');
        } catch (e) {
            if (e.errno !== 1060) console.error('⚠️ [Romaneios] Erro diretorio_rede:', e.message);
        }

        // Coluna pdf_path
        try {
            await conn.execute("ALTER TABLE app_romaneios ADD COLUMN pdf_path VARCHAR(500) NULL");
            console.log('✅ [Romaneios] Coluna pdf_path criada.');
        } catch (e) {
            if (e.errno !== 1060) console.error('⚠️ [Romaneios] Erro pdf_path:', e.message);
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
            try { await conn.execute("ALTER TABLE app_romaneio_revisions ADD COLUMN usuario VARCHAR(100) NULL"); } catch(e){}
            console.log('✅ [Romaneios] Tabela app_romaneio_revisions verificada/criada.');
        } catch (e) {
            console.error('⚠️ [Romaneios] Erro app_romaneio_revisions:', e.message);
        }
        // Tabela de Vínculos de NFs (Muitas NFs para 1 Romaneio)
        try {
            await conn.execute(`
                CREATE TABLE IF NOT EXISTS app_romaneios_nfs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    romaneio_id INT NOT NULL,
                    tipo_nf VARCHAR(20) NOT NULL COMMENT 'saida, retorno',
                    nf_numero VARCHAR(50) NOT NULL,
                    nf_serie VARCHAR(10) NOT NULL,
                    fornecedor_cod VARCHAR(20),
                    fornecedor_loja VARCHAR(10),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_romaneio_nf (romaneio_id),
                    INDEX idx_nf_num (nf_numero)
                )
            `);
            console.log('✅ [Romaneios] Tabela app_romaneios_nfs verificada/criada.');
        } catch (e) {
            console.error('⚠️ [Romaneios] Erro app_romaneios_nfs:', e.message);
        }

        // Limpar espaços em codigo_produto (dados históricos do Protheus com CHAR de largura fixa)
        try {
            await conn.execute("UPDATE app_romaneio_items SET codigo_produto = TRIM(codigo_produto) WHERE codigo_produto != TRIM(codigo_produto)");
            console.log('✅ [Romaneios] codigo_produto trimmed nos itens existentes.');
        } catch (e) {
            console.error('⚠️ [Romaneios] Erro ao trim codigo_produto:', e.message);
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

// Endpoint para retornar o caminho de rede base configurado
router.get('/config/base-dir', requirePermission('romaneios', 'read'), (req, res) => {
    try {
        res.json({ baseDir: getRomaneioBaseDir() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Gerar Caderno PDF Único com Relatório e Desenhos
router.get('/:id/generate-bundle', requirePermission('romaneios', 'read'), async (req, res) => {
    try {
        const id = req.params.id;
        const usuarioGerador = req.user?.name || req.user?.username || req.user?.email || 'Sistema';
        const pdfBuffer = await generateRomaneioBundle(id, { usuarioGerador });

        // Determinar nome do arquivo
        let fileName = `Romaneio_${id}.pdf`;
        try {
            const [rows] = await mysqlPool.execute('SELECT current_revision, data_liberacao FROM app_romaneios WHERE id = ?', [id]);
            if (rows.length > 0) {
                const rev = rows[0].current_revision || 1;
                const dataCriacao = rows[0].data_liberacao
                    ? new Date(rows[0].data_liberacao).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0];
                fileName = `Romaneio_${id}_REV${rev}_${dataCriacao}.pdf`;
            }
        } catch (e) {
            console.warn(`[Romaneios] Não foi possível montar nome do arquivo:`, e.message);
        }

        // Tentar salvar cópia na rede — nunca bloqueia a entrega do PDF ao browser
        try {
            // Pegar o diretório salvo no banco se existir
            const [romRows] = await mysqlPool.execute('SELECT diretorio_rede, current_revision FROM app_romaneios WHERE id = ?', [id]);
            let folderPath = null;
            let rev = 1;

            if (romRows.length > 0) {
                folderPath = romRows[0].diretorio_rede;
            }

            // Se não tiver diretório salvo, reconstrói o padrão (fallback/retrocompatibilidade)
            if (!folderPath) {
                folderPath = path.join(getRomaneioBaseDir(), `RO-${id}`);
            }

            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            const fullPath = path.join(folderPath, fileName);
            fs.writeFileSync(fullPath, pdfBuffer);
            console.log(`✅ [Romaneios] Cópia salva na rede: ${fullPath}`);
            
            // Gravar caminho do PDF no banco de dados
            await mysqlPool.execute('UPDATE app_romaneios SET pdf_path = ? WHERE id = ?', [fullPath, id]);
        } catch (err) {
            console.error(`❌ [Romaneios] Erro ao salvar cópia na rede: ${err.message}`);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Erro ao gerar Caderno PDF do Romaneio:', err);
        res.status(500).json({ error: 'Erro ao gerar caderno PDF: ' + err.message });
    }
});

// Enviar Romaneio por E-mail
router.post('/:id/send-email', requirePermission('romaneios', 'edit'), async (req, res) => {
    try {
        const id = req.params.id;
        const { to, subject, htmlBody, attachments = [] } = req.body;
        const nodemailer = require('nodemailer');
        const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

        // 1. Generate PDF Bundle
        const usuarioGerador = req.user?.name || req.user?.username || 'Sistema';
        const pdfBuffer = await generateRomaneioBundle(id, { usuarioGerador });

        // 2. Fetch Romaneio details for filename
        const [rows] = await mysqlPool.execute('SELECT current_revision, diretorio_rede FROM app_romaneios WHERE id = ?', [id]);
        const rev = rows.length > 0 ? (rows[0].current_revision || 1) : 1;
        const fileName = `Romaneio_${id}_REV${rev}.pdf`;

        // 3. SMTP Config (Using same as email.js)
        const SMTP_CONFIG = {
            host: 'smtp.task.com.br',
            port: 587,
            secure: false,
            auth: { user: 'sincometal@metalfisa.com.br', pass: 'Pro1042@sm' },
            tls: { rejectUnauthorized: false }
        };

        const transporter = nodemailer.createTransport(SMTP_CONFIG);
        const mailOptions = {
            from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject || `Romaneio MetalFisa #${id} - Atualização de Status`,
            html: getCorporateEmailTemplate(htmlBody || '<p>Segue em anexo o caderno do romaneio atualizado.</p>'),
            attachments: [
                { filename: fileName, content: pdfBuffer },
                ...attachments
            ]
        };

        const info = await transporter.sendMail(mailOptions);

        // 4. Log Email in History
        await mysqlPool.execute(
            `INSERT INTO app_emails (message_id, folder, sender_name, sender_email, recipient_email, subject, body_html, has_attachments, date)
             VALUES (?, 'SENT', 'MetalFisa ERP', 'sincometal@metalfisa.com.br', ?, ?, ?, 1, NOW())`,
            [info.messageId, Array.isArray(to) ? to.join(', ') : to, subject, htmlBody]
        );

        res.json({ message: 'E-mail enviado com sucesso!', messageId: info.messageId });
    } catch (err) {
        console.error('Erro ao enviar e-mail do romaneio:', err);
        res.status(500).json({ error: 'Erro ao enviar e-mail: ' + err.message });
    }
});



// Criar Romaneio (Cabeçalho)
router.post('/', requirePermission('romaneios', 'create'), async (req, res) => {
    try {
        const {
            cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
            cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
            motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
            usuario, data_liberacao, data_previsao_retorno, fotos,
            nf_saida, nf_retorno, peso_total, area_pintura_total
        } = req.body;

        const [result] = await mysqlPool.execute(
            `INSERT INTO app_romaneios (
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
                usuario, data_liberacao, data_previsao_retorno, fotos,
                nf_saida, nf_retorno, peso_total, area_pintura_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade || null, veiculo_modelo, veiculo_placa,
                usuario || 'Sistema',
                data_liberacao || new Date(),
                data_previsao_retorno || null,
                fotos ? (typeof fotos === 'string' ? fotos : JSON.stringify(fotos)) : null,
                nf_saida ? (typeof nf_saida === 'string' ? nf_saida : JSON.stringify(nf_saida)) : '[]',
                nf_retorno ? (typeof nf_retorno === 'string' ? nf_retorno : JSON.stringify(nf_retorno)) : '[]',
                peso_total || 0,
                area_pintura_total || 0
            ]
        );

        // --- INTEGRAÇÃO COM DIRETÓRIO DE REDE ---
        const insertId = result.insertId;
        const baseDir = getRomaneioBaseDir();
        const dir = path.join(baseDir, `RO-${insertId}`);
        
        console.log(`📂 [Romaneios] Tentando criar pasta na rede: ${dir}`);
        try {
            if (!fs.existsSync(baseDir)) {
                console.error(`❌ [Romaneios] ATENÇÃO: Diretório base de rede não acessível: ${baseDir}`);
            } else {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`✅ [Romaneios] Pasta criada com sucesso: ${dir}`);
                } else {
                    console.log(`ℹ️ [Romaneios] Pasta já existe: ${dir}`);
                }
                
                // Gravar o caminho no banco de dados
                await mysqlPool.execute('UPDATE app_romaneios SET diretorio_rede = ? WHERE id = ?', [dir, insertId]);
            }
        } catch (e) {
            console.error(`⚠️ [Romaneios] Falha crítica ao criar pasta de rede (${dir}):`, e.message);
        }

        res.json({ id: insertId, message: 'Romaneio criado com sucesso!' });
    } catch (err) {
        console.error('Erro ao criar romaneio:', err);
        res.status(500).json({ error: err.message });
    }
});

// Criar Pasta de Rede Manualmente
router.post('/:id/create-folder', requirePermission('romaneios', 'edit'), async (req, res) => {
    try {
        const romaneioId = req.params.id;
        const baseDir = getRomaneioBaseDir();
        const romaneioDir = path.join(baseDir, `RO-${romaneioId}`);

        if (fs.existsSync(romaneioDir)) {
            return res.status(200).json({ message: 'A pasta já existe na rede!', path: romaneioDir });
        }

        await fs.promises.mkdir(romaneioDir, { recursive: true });
        res.status(200).json({ message: 'Pasta criada com sucesso!', path: romaneioDir });
    } catch (err) {
        console.error('Erro ao criar pasta manual:', err);
        if (err.message.includes('EACCES')) {
            return res.status(500).json({ error: 'Erro de permissão no Linux (EACCES). O diretório de rede pai não está montado ou mapeado na nuvem Sinco.' });
        }
        res.status(500).json({ error: 'Erro ao gravar no servidor: ' + err.message });
    }
});

// Atualizar Romaneio (Cabeçalho)
router.put('/:id', requirePermission('romaneios', 'edit'), async (req, res) => {
    try {
        const {
            cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
            cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
            motorista_nome, motorista_cnh, motorista_cnh_validade, veiculo_modelo, veiculo_placa,
            data_liberacao, data_previsao_retorno, fotos,
            nf_saida, nf_retorno, peso_total, area_pintura_total
        } = req.body;

        await mysqlPool.execute(
            `UPDATE app_romaneios SET
                cliente_cod=?, cliente_loja=?, cliente_nome=?, tipo_id=?, observacao_geral=?,
                cliente_endereco=?, cliente_bairro=?, cliente_cidade=?, cliente_uf=?, cliente_cep=?, cliente_telefone=?,
                motorista_nome=?, motorista_cnh=?, motorista_cnh_validade=?, veiculo_modelo=?, veiculo_placa=?,
                data_liberacao=?, data_previsao_retorno=?, fotos=?,
                nf_saida=?, nf_retorno=?, peso_total=?, area_pintura_total=?
             WHERE id = ?`,
            [
                cliente_cod, cliente_loja, cliente_nome, tipo_id, observacao_geral,
                cliente_endereco, cliente_bairro, cliente_cidade, cliente_uf, cliente_cep, cliente_telefone,
                motorista_nome, motorista_cnh, motorista_cnh_validade || null, veiculo_modelo, veiculo_placa,
                data_liberacao, data_previsao_retorno || null,
                fotos ? (typeof fotos === 'string' ? fotos : JSON.stringify(fotos)) : null,
                nf_saida ? (typeof nf_saida === 'string' ? nf_saida : JSON.stringify(nf_saida)) : '[]',
                nf_retorno ? (typeof nf_retorno === 'string' ? nf_retorno : JSON.stringify(nf_retorno)) : '[]',
                peso_total || 0,
                area_pintura_total || 0,
                req.params.id
            ]
        );

        res.json({ message: 'Romaneio atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar romaneio:', err);
        res.status(500).json({ error: err.message });
    }
});

// Patch targeted for return forecast date
router.patch('/:id/forecast-date', requirePermission('romaneios', 'edit'), async (req, res) => {
    try {
        const { data_previsao_retorno } = req.body;
        const romaneioId = req.params.id;

        await mysqlPool.execute(
            'UPDATE app_romaneios SET data_previsao_retorno = ? WHERE id = ?',
            [data_previsao_retorno || null, romaneioId]
        );

        res.json({ message: 'Data de previsão atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar data de previsão:', err);
        res.status(500).json({ error: err.message });
    }
});

// Verificar se um item de OP já foi enviado em romaneios anteriores
router.get('/check-op-item', requirePermission('romaneios', 'read'), async (req, res) => {
    try {
        const { op, item } = req.query;
        if (!op || !item) return res.json([]);

        // Buscar itens dessa OP/Item em romaneios que NÃO estejam Cancelados
        const [rows] = await mysqlPool.execute(`
            SELECT 
                r.id as romaneio_id, 
                r.status, 
                r.data_criacao, 
                i.quantidade as qtd_enviada
            FROM app_romaneio_items i
            JOIN app_romaneios r ON i.romaneio_id = r.id
            WHERE i.op = ? AND i.item_op = ? AND r.status != 'Cancelado'
            ORDER BY r.data_criacao DESC
        `, [op, item]);

        res.json(rows);
    } catch (err) {
        console.error('Erro ao verificar disponibilidade do item da OP:', err);
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
            SELECT i.*,
                COALESCE(i.peso_unitario,         (SELECT d.peso_kg         FROM produtos_docs d WHERE TRIM(d.produto_codigo) = TRIM(i.codigo_produto) LIMIT 1)) AS peso_kg,
                COALESCE(i.area_pintura_unitario, (SELECT d.area_pintura_m2 FROM produtos_docs d WHERE TRIM(d.produto_codigo) = TRIM(i.codigo_produto) LIMIT 1)) AS area_pintura_m2,
                (SELECT COALESCE(SUM(quantidade), 0) FROM app_romaneio_recebimentos WHERE romaneio_item_id = i.id) AS qtd_recebida,
                (SELECT d.url_arquivo FROM produtos_docs d WHERE TRIM(d.produto_codigo) = TRIM(i.codigo_produto) AND d.url_arquivo IS NOT NULL AND d.url_arquivo != '' LIMIT 1) AS url_arquivo
            FROM app_romaneio_items i
            WHERE i.romaneio_id = ?
        `, [req.params.id]);

        // Adicionar e-mail e CNPJ do cliente (busca no Postgres)
        let clienteEmail = '';
        let clienteCnpj = '';
        if (romaneio[0].cliente_cod) {
            try {
                const { rows: cliRows } = await db.query(
                    'SELECT A2_EMAIL as email, A2_CGC as cnpj FROM public.sa2010 WHERE A2_COD = $1 AND A2_LOJA = $2 AND COALESCE(D_E_L_E_T_, \'\') IN (\'\', \' \')',
                    [romaneio[0].cliente_cod.trim(), romaneio[0].cliente_loja || '01']
                );
                if (cliRows.length > 0) {
                    clienteEmail = (cliRows[0].email || '').trim();
                    clienteCnpj = (cliRows[0].cnpj || '').trim();
                }
            } catch (e) {
                console.error('Erro ao buscar dados do cliente no Protheus:', e.message);
            }
        }

        res.json({ ...romaneio[0], cliente_email: clienteEmail, cliente_cnpj: clienteCnpj, itens });
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
            [romaneio_id, pedido, item_pedido, (codigo_produto || '').trim(), (descricao_produto || '').trim(), quantidade, comentario, valor_unitario || 0]
        );

        res.json({ message: 'Item adicionado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Atualizar Status
router.put('/:id/status', requirePermission('romaneios', 'edit'), async (req, res) => {
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();
        const { status, data_alteracao, usuario } = req.body;
        const romaneioId = req.params.id;

        // 1. Update the status
        await conn.execute('UPDATE app_romaneios SET status = ? WHERE id = ?', [status, romaneioId]);

        // 2. Snapshot Data for Revision
        const [rows] = await conn.query('SELECT * FROM app_romaneios WHERE id = ?', [romaneioId]);
        if (rows.length > 0) {
            const header = rows[0];
            const [items] = await conn.query('SELECT * FROM app_romaneio_items WHERE romaneio_id = ?', [romaneioId]);
            const snapshot = { header, items };

            const currentRev = header.current_revision || 1;
            const reason = `Status alterado para ${status}${data_alteracao ? ` em ${data_alteracao}` : ''}`;
            
            // 3. Create Revision
            await conn.execute(
                'INSERT INTO app_romaneio_revisions (romaneio_id, revision_number, snapshot_data, reason, usuario) VALUES (?, ?, ?, ?, ?)',
                [romaneioId, currentRev, JSON.stringify(snapshot), reason, usuario || 'Sistema']
            );

            // 4. Increment Revision
            await conn.execute('UPDATE app_romaneios SET current_revision = current_revision + 1 WHERE id = ?', [romaneioId]);
        }

        await conn.commit();
        res.json({ message: 'Status atualizado com histórico registrado' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
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
        const { quantidade, comentario, valor_unitario, peso_unitario, area_pintura_unitario } = req.body;

        await mysqlPool.execute(
            `UPDATE app_romaneio_items
             SET quantidade = ?, comentario = ?, valor_unitario = ?,
                 peso_unitario = ?, area_pintura_unitario = ?
             WHERE id = ? AND romaneio_id = ?`,
            [
                quantidade, comentario, valor_unitario || 0,
                peso_unitario != null && peso_unitario !== '' ? peso_unitario : null,
                area_pintura_unitario != null && area_pintura_unitario !== '' ? area_pintura_unitario : null,
                req.params.itemId, req.params.id
            ]
        );

        // Atualizar cadastro original do produto em produtos_docs se informado
        if (peso_unitario != null && peso_unitario !== '' || area_pintura_unitario != null && area_pintura_unitario !== '') {
            const [itemRows] = await mysqlPool.execute(
                'SELECT codigo_produto FROM app_romaneio_items WHERE id = ?', [req.params.itemId]
            );
            if (itemRows.length > 0) {
                const cod = itemRows[0].codigo_produto;
                const updates = [];
                const vals = [];
                if (peso_unitario != null && peso_unitario !== '') { updates.push('peso_kg = ?'); vals.push(peso_unitario); }
                if (area_pintura_unitario != null && area_pintura_unitario !== '') { updates.push('area_pintura_m2 = ?'); vals.push(area_pintura_unitario); }
                if (updates.length > 0) {
                    vals.push(cod.trim());
                    // Atualiza o primeiro registro de desenho do produto (ou qualquer registro existente)
                    await mysqlPool.execute(
                        `UPDATE produtos_docs SET ${updates.join(', ')} WHERE TRIM(produto_codigo) = ? LIMIT 1`,
                        vals
                    );
                    // Se não existe registro, insere um básico para guardar o peso/área
                    const [existRows] = await mysqlPool.execute(
                        'SELECT id FROM produtos_docs WHERE TRIM(produto_codigo) = ? LIMIT 1', [cod.trim()]
                    );
                    if (existRows.length === 0) {
                        const insertCols = ['produto_codigo', 'titulo', 'tipo', 'url_arquivo'];
                        const insertVals = [cod.trim(), 'Dados Técnicos', 'Técnico', ''];
                        if (peso_unitario != null && peso_unitario !== '') { insertCols.push('peso_kg'); insertVals.push(peso_unitario); }
                        if (area_pintura_unitario != null && area_pintura_unitario !== '') { insertCols.push('area_pintura_m2'); insertVals.push(area_pintura_unitario); }
                        await mysqlPool.execute(
                            `INSERT INTO produtos_docs (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`,
                            insertVals
                        );
                    }
                }
            }
        }

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
        const { usuario } = req.body; // Se for passado
        await conn.execute(
            'INSERT INTO app_romaneio_revisions (romaneio_id, revision_number, snapshot_data, reason, usuario) VALUES (?, ?, ?, ?, ?)',
            [romaneioId, currentRev, JSON.stringify(snapshot), reason, usuario || 'Sistema']
        );

        // 3. Increment revision in main table
        await conn.execute('UPDATE app_romaneios SET current_revision = current_revision + 1 WHERE id = ?', [romaneioId]);

        await conn.commit();

        // --- INTEGRAÇÃO COM DIRETÓRIO DE REDE (REVISÃO) ---
        const newRev = currentRev + 1;
        const revDir = path.join(getRomaneioBaseDir(), `RO-${romaneioId}`, `REV-${newRev}`);
        fs.promises.mkdir(revDir, { recursive: true })
            .then(() => console.log(`✅ Pasta de revisão criada na rede: ${revDir}`))
            .catch(e => console.error(`⚠️ Erro ao criar pasta de revisão na rede (${revDir}):`, e.message));

        res.json({ message: 'Revisão criada com sucesso', newRevision: newRev });
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
            'SELECT id, revision_number, created_at, reason, usuario FROM app_romaneio_revisions WHERE romaneio_id = ? ORDER BY revision_number DESC',
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
    let connection;
    try {
        const { romaneio_id, quantidade, usuario, observacao, data_recebimento, operacao_baixa } = req.body;
        const romaneio_item_id = req.params.itemId;

        if (!quantidade || quantidade <= 0) {
            return res.status(400).json({ error: 'Quantidade inválida' });
        }

        let dataFormatada = data_recebimento || new Date();
        if (typeof dataFormatada === 'string' && dataFormatada.includes('T')) {
            dataFormatada = dataFormatada.replace('T', ' ') + (dataFormatada.length === 16 ? ':00' : '');
        }

        connection = await mysqlPool.getConnection();
        await connection.beginTransaction();

        await connection.execute(
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

        if (operacao_baixa) {
            const [itemRows] = await connection.execute('SELECT pedido, item_pedido, codigo_produto, romaneio_id FROM app_romaneio_items WHERE id = ?', [romaneio_item_id]);
            if (itemRows.length > 0) {
                const { pedido, item_pedido } = itemRows[0];
                let pgRes = { rows: [] };

                if (pedido) {
                    const pgQuery = `
                        SELECT TRIM(c2_num) as op_numero, TRIM(c2_item) as op_item, TRIM(c2_sequen) as op_sequencia, TRIM(c2_quant) as op_quantidade
                        FROM public.sc2010
                        WHERE (
                            (REPLACE(TRIM(c2_pedido), ' ', '') = REPLACE(TRIM($1), ' ', '') AND REPLACE(TRIM(c2_itempv), ' ', '') = REPLACE(TRIM($2), ' ', ''))
                            OR (TRIM(COALESCE(c2_pedido, '')) = '' AND REPLACE(TRIM(c2_obs), ' ', '') LIKE $3 AND REPLACE(TRIM(c2_itempv), ' ', '') = REPLACE(TRIM($2), ' ', ''))
                            OR (TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen) = REPLACE(TRIM($1), ' ', ''))
                        )
                        AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                        LIMIT 1
                    `;
                    const searchObs = `${pedido.trim().replace(/\s/g, '')}%`;
                    pgRes = await db.query(pgQuery, [pedido.trim(), item_pedido?.trim() || '', searchObs]);
                }

                if (pgRes.rows.length > 0) {
                    const { op_numero, op_item, op_sequencia, op_quantidade } = pgRes.rows[0];
                    
                    // Validate if the specific operation has remaining balance
                    const [aptRows] = await connection.query(`
                        SELECT SUM(quantidade) AS apontado
                        FROM app_production_appointments
                        WHERE op_numero = ? AND op_item = ? AND op_sequencia = ? AND operacao_codigo = ? AND status != 'CANCELADO'
                    `, [op_numero, op_item, op_sequencia, operacao_baixa]);
                    
                    const apontado = aptRows[0].apontado || 0;
                    const maxQtd = parseFloat(op_quantidade) || 0;
                    const saldoOperacao = maxQtd - apontado;
                    
                    if (Number(quantidade) > saldoOperacao) {
                        await connection.rollback();
                        return res.status(400).json({ error: `Não foi possível realizar a baixa automática: A quantidade (${quantidade}) excede o saldo pendente desta operação na OP (${saldoOperacao}).` });
                    }

                    const [configRows] = await connection.query('SELECT general_config FROM app_company_settings WHERE id = 1');
                    let enableVerification = false;
                    if (configRows.length > 0 && configRows[0].general_config) {
                        const cfg = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
                        enableVerification = !!cfg.enable_production_verification;
                    }
                    const initialStatus = enableVerification ? 'PENDENTE' : 'OK';
                    const observacaoApontamento = `Baixa automática via Retorno de Romaneio #${romaneio_id}. ${observacao || ''}`;
                    
                    await connection.execute(`
                        INSERT INTO app_production_appointments
                        (op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, conferencia_status)
                        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [op_numero, op_item, op_sequencia, operacao_baixa, usuario || 'Sistema', quantidade, dataFormatada, dataFormatada, observacaoApontamento, initialStatus]);
                } else {
                    // Fail the transaction if user requested "operacao_baixa" but OP wasn't found
                    await connection.rollback();
                    return res.status(400).json({ error: 'Não foi possível realizar a baixa automática: Ordem de Produção não encontrada no Protheus para este item.' });
                }
            }
        }

        await connection.commit();
        res.json({ message: 'Recebimento registrado com sucesso' });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
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

// 4. Operações de Produção associadas a este item
router.get('/items/:itemId/operations', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        const [rows] = await mysqlPool.execute('SELECT codigo_produto FROM app_romaneio_items WHERE id = ?', [itemId]);
        if (rows.length === 0 || !rows[0].codigo_produto) return res.json([]);
        
        const codigo_produto = rows[0].codigo_produto;
        const pgQuery = `
            SELECT TRIM(g2.g2_operac) as operacao_codigo, TRIM(h1.h1_descri) as operacao_desc
            FROM public.sg2010 g2
            LEFT JOIN public.sh1010 h1 ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE REPLACE(TRIM(g2.g2_produto), ' ', '') = REPLACE(TRIM($1), ' ', '') AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY g2.g2_operac ASC
        `;
        const pgResult = await db.query(pgQuery, [codigo_produto]);
        res.json(pgResult.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- NOTAS FISCAIS E VÍNCULOS ---

// Busca Cabeçalhos das NFs de um Fornecedor no Protheus (SF1010 + SA2010)
router.get('/protheus/nfs', async (req, res) => {
    try {
        const { fornecedor, loja, search, globalSearch } = req.query;
        
        let cte1 = `
            SELECT 
                F1.F1_DOC AS "Num_NF",
                F1.F1_SERIE AS "Serie",
                F1.F1_EMISSAO AS "Data_Emissao",
                F1.F1_FORNECE AS "Cod_Fornecedor",
                A2.A2_NOME AS "Razao_Social_Fornecedor",
                A2.A2_CGC AS "CNPJ_Fornecedor",
                F1.F1_ESPECIE AS "Tipo_Doc",
                'Retorno' AS "Direcao",
                A2.A2_LOJA AS "Loja"
            FROM public.sf1010 F1
            INNER JOIN public.sa2010 A2 ON A2.A2_COD = F1.F1_FORNECE 
                                AND A2.A2_LOJA = F1.F1_LOJA
                                AND COALESCE(A2.D_E_L_E_T_, '') IN ('', ' ')
            WHERE COALESCE(F1.D_E_L_E_T_, '') IN ('', ' ')
        `;

        let cte2 = `
            SELECT 
                F2.F2_DOC AS "Num_NF",
                F2.F2_SERIE AS "Serie",
                F2.F2_EMISSAO AS "Data_Emissao",
                F2.F2_CLIENTE AS "Cod_Fornecedor",
                COALESCE(A1.A1_NOME, A2.A2_NOME) AS "Razao_Social_Fornecedor",
                COALESCE(A1.A1_CGC, A2.A2_CGC) AS "CNPJ_Fornecedor",
                F2.F2_ESPECIE AS "Tipo_Doc",
                'Saída' AS "Direcao",
                F2.F2_LOJA AS "Loja"
            FROM public.sf2010 F2
            LEFT JOIN public.sa1010 A1 ON A1.A1_COD = F2.F2_CLIENTE AND A1.A1_LOJA = F2.F2_LOJA AND F2.F2_TIPO NOT IN ('B', 'D')
            LEFT JOIN public.sa2010 A2 ON A2.A2_COD = F2.F2_CLIENTE AND A2.A2_LOJA = F2.F2_LOJA AND F2.F2_TIPO IN ('B', 'D')
            WHERE COALESCE(F2.D_E_L_E_T_, '') IN ('', ' ')
        `;

        let sql = `
            WITH combined_nfs AS (
                ${cte1}
                UNION ALL
                ${cte2}
            )
            SELECT * FROM combined_nfs WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (globalSearch !== 'true') {
            if (!fornecedor) return res.status(400).json({ error: 'Fornecedor obrigatório se não for busca global.' });
            sql += ` AND "Cod_Fornecedor" = $${paramIndex}`;
            params.push(fornecedor);
            paramIndex++;
            
            if (loja) {
                sql += ` AND "Loja" = $${paramIndex}`;
                params.push(loja);
                paramIndex++;
            }
        }

        if (search) {
            const tokens = search.split(/[\s\-]+/).filter(t => t.trim().length > 0);
            
            if (tokens.length > 0) {
                const tokenConditions = tokens.map(token => {
                    const isNumeric = /^\d+$/.test(token);
                    let paddedToken = token;
                    if (isNumeric && token.length <= 9) {
                        paddedToken = token.padStart(9, '0');
                    }
                    
                    let condition = `("Num_NF" ILIKE $${paramIndex} OR "Razao_Social_Fornecedor" ILIKE $${paramIndex}`;
                    params.push(`%${token}%`);
                    paramIndex++;

                    if (isNumeric) {
                        condition += ` OR "Num_NF" ILIKE $${paramIndex}`;
                        params.push(`%${paddedToken}%`);
                        paramIndex++;
                    }
                    
                    condition += `)`;
                    return condition;
                });

                sql += ` AND (${tokenConditions.join(' AND ')})`;
            }
        }

        sql += ` ORDER BY "Data_Emissao" DESC LIMIT 100`;

        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar NFs no Protheus:', err);
        res.status(500).json({ error: 'Erro ao buscar Notas Fiscais.' });
    }
});

// Busca Itens (Espelho) de uma NF no Protheus (SD1/SD2 + SB1) + cabeçalho SF1/SF2
router.get('/protheus/nf-items', async (req, res) => {
    try {
        const { nf, serie, fornecedor, tipo_nf } = req.query;
        if (!nf) return res.status(400).json({ error: 'Número da NF obrigatório.' });

        const nfPadded = nf.padStart(9, '0');
        const isSaida = (tipo_nf && tipo_nf.toLowerCase() === 'saida');
        const tbItem = isSaida ? 'public.sd2010' : 'public.sd1010';
        const pfx   = isSaida ? 'D2' : 'D1';

        // --- Itens ---
        let itemSql = `
            SELECT
                D.${pfx}_DOC    AS "Num_NF",
                D.${pfx}_ITEM   AS "Seq",
                D.${pfx}_COD    AS "Cod_Produto",
                B1.B1_DESC      AS "Descricao_Produto",
                D.${pfx}_QUANT              AS "Qtd",
                D.${pfx}_UM                 AS "UM",
                D.${pfx}_CF                 AS "CFOP",
                D.${isSaida ? 'd2_prunit' : 'd1_vunit'} AS "Vl_Unit",
                D.${pfx}_TOTAL              AS "Vl_Total"
            FROM ${tbItem} D
            INNER JOIN public.sb1010 B1 ON B1.B1_COD = D.${pfx}_COD
                AND COALESCE(B1.D_E_L_E_T_, '') IN ('', ' ')
            WHERE COALESCE(D.D_E_L_E_T_, '') IN ('', ' ')
                AND D.${pfx}_DOC = $1
        `;
        const itemParams = [nfPadded];
        let pIdx = 2;

        if (serie) {
            itemSql += ` AND D.${pfx}_SERIE = $${pIdx++}`;
            itemParams.push(serie);
        }
        if (fornecedor) {
            itemSql += ` AND (TRIM(D.${pfx}_CLIENTE) = TRIM($${pIdx}) OR TRIM(D.${pfx}_FORNECE) = TRIM($${pIdx}))`;
            itemParams.push(fornecedor.trim());
            pIdx++;
        }
        itemSql += ` ORDER BY D.${pfx}_DOC, D.${pfx}_ITEM`;

        // --- Cabeçalho da NF (SF1 ou SF2) ---
        let headSql, headParams = [nfPadded];
        if (isSaida) {
            headSql = `
                SELECT
                    F2.F2_DOC      AS "Num_NF",
                    F2.F2_SERIE    AS "Serie",
                    F2.F2_EMISSAO  AS "Data_Emissao",
                    F2.F2_VALBRUT  AS "Vl_Bruto",
                    F2.F2_FRETE    AS "Vl_Frete",
                    F2.F2_CLIENTE  AS "Parceiro_Cod",
                    F2.F2_LOJA     AS "Parceiro_Loja",
                    COALESCE(A1.A1_NOME, A2.A2_NOME) AS "Parceiro_Nome",
                    COALESCE(A1.A1_CGC,  A2.A2_CGC)  AS "Parceiro_CNPJ",
                    'Saída' AS "Direcao"
                FROM public.sf2010 F2
                LEFT JOIN public.sa1010 A1 ON A1.A1_COD = F2.F2_CLIENTE AND A1.A1_LOJA = F2.F2_LOJA
                    AND COALESCE(A1.D_E_L_E_T_, '') IN ('', ' ')
                LEFT JOIN public.sa2010 A2 ON A2.A2_COD = F2.F2_CLIENTE AND A2.A2_LOJA = F2.F2_LOJA
                    AND COALESCE(A2.D_E_L_E_T_, '') IN ('', ' ')
                WHERE COALESCE(F2.D_E_L_E_T_, '') IN ('', ' ')
                    AND F2.F2_DOC = $1
            `;
            if (serie) { headSql += ` AND F2.F2_SERIE = $2`; headParams.push(serie); }
        } else {
            headSql = `
                SELECT
                    F1.F1_DOC      AS "Num_NF",
                    F1.F1_SERIE    AS "Serie",
                    F1.F1_EMISSAO  AS "Data_Emissao",
                    F1.F1_VALBRUT  AS "Vl_Bruto",
                    F1.F1_FRETE    AS "Vl_Frete",
                    COALESCE(NULLIF(F1.F1_CLIENTE, ''), F1.F1_FORNECE)  AS "Parceiro_Cod",
                    COALESCE(NULLIF(F1.F1_LOJACLI, ''), F1.F1_LOJA)     AS "Parceiro_Loja",
                    COALESCE(A1.A1_NOME, A2.A2_NOME) AS "Parceiro_Nome",
                    COALESCE(A1.A1_CGC, A2.A2_CGC)  AS "Parceiro_CNPJ",
                    'Retorno' AS "Direcao"
                FROM public.sf1010 F1
                LEFT JOIN public.sa1010 A1 ON A1.A1_COD = F1.F1_CLIENTE AND A1.A1_LOJA = F1.F1_LOJACLI
                    AND COALESCE(A1.D_E_L_E_T_, '') IN ('', ' ')
                LEFT JOIN public.sa2010 A2 ON A2.A2_COD = F1.F1_FORNECE AND A2.A2_LOJA = F1.F1_LOJA
                    AND COALESCE(A2.D_E_L_E_T_, '') IN ('', ' ')
                WHERE COALESCE(F1.D_E_L_E_T_, '') IN ('', ' ')
                    AND F1.F1_DOC = $1
            `;
            if (serie) { headSql += ` AND F1.F1_SERIE = $2`; headParams.push(serie); }
        }

        const [itemResult, headResult] = await Promise.all([
            db.query(itemSql, itemParams),
            db.query(headSql, headParams)
        ]);

        res.json({ header: headResult.rows[0] || null, items: itemResult.rows });
    } catch (err) {
        console.error('Erro ao buscar itens da NF no Protheus:', err);
        res.status(500).json({ error: 'Erro ao buscar Itens da NF.' });
    }
});

// Busca os Vínculos de NFs salvos no MySQL para um Romaneio
router.get('/:id/notas-fiscais', async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute(
            'SELECT * FROM app_romaneios_nfs WHERE romaneio_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Adiciona um Vínculo de NF a um Romaneio no MySQL
router.post('/:id/notas-fiscais', requirePermission('romaneios', 'update'), async (req, res) => {
    try {
        const romaneio_id = req.params.id;
        const { tipo_nf, nf_numero, nf_serie, fornecedor_cod, fornecedor_loja } = req.body;

        if (!tipo_nf || !nf_numero) {
            return res.status(400).json({ error: 'Tipo e número da NF são obrigatórios.' });
        }

        // Verificar se a NF já está vinculada a este romaneio
        const [existing] = await mysqlPool.execute(
            `SELECT id FROM app_romaneios_nfs WHERE romaneio_id = ? AND nf_numero = ? AND nf_serie = ? AND tipo_nf = ?`,
            [romaneio_id, nf_numero, nf_serie || '', tipo_nf]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: `A NF ${nf_numero.replace(/^0+/, '')} série ${nf_serie || '-'} já está vinculada a este romaneio.` });
        }

        const [result] = await mysqlPool.execute(`
            INSERT INTO app_romaneios_nfs
                (romaneio_id, tipo_nf, nf_numero, nf_serie, fornecedor_cod, fornecedor_loja)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [romaneio_id, tipo_nf, nf_numero, nf_serie || '', fornecedor_cod || '', fornecedor_loja || '']);

        res.json({ id: result.insertId, message: 'NF vinculada com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove um Vínculo de NF
router.delete('/:id/notas-fiscais/:nfId', requirePermission('romaneios', 'update'), async (req, res) => {
    try {
        const { id, nfId } = req.params;
        await mysqlPool.execute(
            'DELETE FROM app_romaneios_nfs WHERE id = ? AND romaneio_id = ?',
            [nfId, id]
        );
        res.json({ message: 'Vínculo da NF removido.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Envio de Cobrança em Lote por Fornecedor (Follow-up)
router.post('/recebimentos/batch-followup', requirePermission('romaneios', 'edit'), async (req, res) => {
    try {
        const { supplierCod, supplierLoja, customMessage, items, recipients = [] } = req.body;
        const nodemailer = require('nodemailer');
        const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

        if (!supplierCod || !items || items.length === 0) {
            return res.status(400).json({ error: 'Fornecedor e lista de itens são obrigatórios para a cobrança.' });
        }

        // 1. Buscar Dados do Fornecedor no Protheus (Opcional - apenas para validar/pegar nome oficial)
        let supplierName = 'Fornecedor';
        try {
            const { rows: cliRows } = await db.query(
                `SELECT A2_EMAIL, A2_NOME FROM public.sa2010 
                 WHERE (TRIM(A2_COD) = TRIM($1) OR A2_COD = $1)
                 AND A2_LOJA = $2 
                 AND COALESCE(D_E_L_E_T_, '') IN ('', ' ')`,
                [supplierCod.trim(), supplierLoja || '01']
            );
            if (cliRows.length > 0) {
                supplierName = (cliRows[0].a2_nome || 'Fornecedor').trim();
            }
        } catch (dbErr) {
            console.warn('[Cobranca] Erro ao buscar fornecedor no Protheus:', dbErr.message);
        }

        const finalRecipients = Array.isArray(recipients) ? recipients.filter(e => e && e.includes('@')) : [];

        if (finalRecipients.length === 0) {
            return res.status(400).json({ error: 'É necessário ao menos um destinatário válido para enviar a cobrança.' });
        }

        // 2. Montar Tabela HTML dos itens
        let itemsHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-family: sans-serif; font-size: 13px;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Romaneio</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Pedido</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Produto</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0;">Descrição</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">Pendente</th>
                        <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Previsão</th>
                    </tr>
                </thead>
                <tbody>
        `;

        items.forEach(item => {
            const dataPrev = item.data_previsao_retorno ? new Date(item.data_previsao_retorno + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-';
            itemsHtml += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #e2e8f0;">#${item.romaneio_id}</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${item.pedido || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0;"><b>${item.codigo_produto}</b></td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0;">${item.descricao_produto}</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${item.saldo_pendente}</td>
                    <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${dataPrev}</td>
                </tr>
            `;
        });

        itemsHtml += `</tbody></table>`;

        // 3. Gerar Corpo do E-mail
        const bodyContent = `
            <div style="font-family: Arial, sans-serif; color: #334155; line-height: 1.6;">
                <h2 style="color: #0f172a;">Cobrança de Retorno - MetalFisa</h2>
                <p>Prezados, <b>${supplierName}</b>,</p>
                ${customMessage ? `<p style="background: #f8fafc; padding: 15px; border-left: 4px solid #4f46e5; font-style: italic;">"${customMessage.replace(/\n/g, '<br>')}"</p>` : ''}
                <p>Identificamos que os itens abaixo, enviados via romaneio, ainda não retornaram ou estão com a data de previsão ultrapassada. Solicitamos uma atualização sobre o status de entrega destes materiais:</p>
                ${itemsHtml}
                <p style="margin-top: 25px;">Por favor, nos responda com a previsão atualizada para que possamos alinhar nosso planejamento de produção.</p>
                <p>Atenciosamente,<br><b>Equipe MetalFisa</b></p>
            </div>
        `;

        // 4. Configuração SMTP e Envio
        const SMTP_CONFIG = {
            host: 'smtp.task.com.br',
            port: 587,
            secure: false,
            auth: { user: 'sincometal@metalfisa.com.br', pass: 'Pro1042@sm' },
            tls: { rejectUnauthorized: false }
        };

        const transporter = nodemailer.createTransport(SMTP_CONFIG);
        const mailOptions = {
            from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
            to: finalRecipients.join(', '),
            subject: `[COBRANÇA] Pendências de Retorno - MetalFisa (${supplierName})`,
            html: getCorporateEmailTemplate(bodyContent)
        };

        const info = await transporter.sendMail(mailOptions);

        // 5. Registrar Revisão/Histórico em cada Romaneio envolvido
        const romaneioIds = [...new Set(items.map(i => i.romaneio_id))];
        const usuarioDesc = req.user?.name || req.user?.login || 'Sistema';
        const recipientsStr = finalRecipients.join(', ');

        for (const rid of romaneioIds) {
            // Pegar a revisão atual para incrementar
            const [romRows] = await mysqlPool.execute('SELECT current_revision FROM app_romaneios WHERE id = ?', [rid]);
            const rev = romRows.length > 0 ? (romRows[0].current_revision || 1) : 1;

            await mysqlPool.execute(
                `INSERT INTO app_romaneio_revisions (romaneio_id, revision_number, snapshot_data, reason, usuario)
                 VALUES (?, ?, ?, ?, ?)`,
                [rid, rev, '{}', `Cobrança de Follow-up enviada para os destinatários (${recipientsStr})`, usuarioDesc]
            );

            // Incrementar revisão
            await mysqlPool.execute('UPDATE app_romaneios SET current_revision = current_revision + 1 WHERE id = ?', [rid]);
        }

        // 6. Registrar no log de e-mails geral
        await mysqlPool.execute(
            `INSERT INTO app_emails (message_id, folder, sender_name, sender_email, recipient_email, subject, body_html, has_attachments, date)
             VALUES (?, 'SENT', 'MetalFisa ERP', 'sincometal@metalfisa.com.br', ?, ?, ?, 0, NOW())`,
            [info.messageId, recipientsStr, mailOptions.subject, bodyContent]
        );

        res.json({ message: 'Cobrança enviada com sucesso!', messageId: info.messageId, recipients: recipientsStr });
    } catch (err) {
        console.error('❌ [EnviaCobrança] Erro:', err);
        const errorDetail = err.message || 'Erro interno desconhecido';
        res.status(500).json({ 
            error: 'Erro ao processar cobrança: ' + errorDetail,
            details: err.response?.data || err.stack
        });
    }
});

module.exports = router;
