const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateToolboxReport } = require('../services/pdfToolboxService');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = path.join(__dirname, '../uploads/certificados');
        if (file.fieldname === 'photos' || file.fieldname === 'pdfs') {
            uploadPath = path.join(__dirname, '../uploads/ativos_anexos');
        }
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = file.fieldname === 'photos' ? 'photo-' : (file.fieldname === 'pdfs' ? 'pdf-' : 'cert-');
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });



// Memory storage for attachments
const memoryUpload = multer({ storage: multer.memoryStorage() });

// === ATIVOS (ASSETS) ===

// GET /api/sgq/assets
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT a.*, 
                   (SELECT id FROM sgq_asset_attachments WHERE asset_id = a.id AND file_type = 'photo' AND is_main = TRUE LIMIT 1) as main_photo_id
            FROM sgq_assets a 
            ORDER BY a.id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar ativos:', error);
        res.status(500).json({ error: 'Erro interno ao consultar ativos.' });
    }
});

// POST /api/sgq/assets
router.post('/', async (req, res) => {
    try {
        const { patrimonio, name, model, serial_number, status, calibration_validity, alerts, requires_calibration, stock_quantity, user_name } = req.body;

        if (patrimonio && requires_calibration !== false) {
            const [existing] = await db.query('SELECT id FROM sgq_assets WHERE patrimonio = ?', [patrimonio]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Já existe um ativo cadastrado com este patrimônio.' });
            }
        }

        const rc = requires_calibration === undefined ? true : Boolean(requires_calibration);
        const sq = rc ? 1 : parseInt(stock_quantity || 0, 10);

        const [result] = await db.query(`
            INSERT INTO sgq_assets (patrimonio, name, model, serial_number, status, calibration_validity, requires_calibration, stock_quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [patrimonio, name, model, serial_number, status || 'available', calibration_validity, rc, sq]);
        
        const assetId = result.insertId;

        if (!rc) {
            await db.query(`
                INSERT INTO sgq_asset_transactions (asset_id, type, quantity, user_name, reason)
                VALUES (?, 'entrada', ?, ?, 'Cadastro Inicial')
            `, [assetId, sq, user_name || 'Sistema']);
        }

        if (alerts && Array.isArray(alerts) && alerts.length > 0) {
            const values = alerts.map(a => [
                assetId, 
                a.days_before, 
                a.notify_email ? 1 : 0, 
                a.notify_whatsapp ? 1 : 0, 
                JSON.stringify(a.target_users || [])
            ]);
            await db.query(`
                INSERT INTO sgq_asset_alerts (asset_id, days_before, notify_email, notify_whatsapp, target_users)
                VALUES ?
            `, [values]);
        }
        
        res.status(201).json({ message: 'Ativo criado com sucesso.', id: assetId });
    } catch (error) {
        console.error('Erro ao criar ativo:', error);
        res.status(500).json({ error: 'Erro interno ao criar ativo.' });
    }
});

// POST /api/sgq/assets/bulk (Clonagem)
router.post('/bulk', async (req, res) => {
    try {
        const { masterAsset, quantity } = req.body;
        const num = parseInt(quantity, 10);
        if (!num || num <= 0) return res.status(400).json({ error: 'Quantidade inválida.' });

        if (masterAsset.patrimonio) {
            const tempPatrimonios = [];
            for (let i = 1; i <= num; i++) tempPatrimonios.push(`${masterAsset.patrimonio}-${i}`);
            const [existing] = await db.query('SELECT patrimonio FROM sgq_assets WHERE patrimonio IN (?)', [tempPatrimonios]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Um ou mais patrimônios gerados (ex: ' + existing[0].patrimonio + ') já existem. Escolha outro prefixo ou deixe em branco.' });
            }
        }

        const values = [];
        // Generate values for bulk insert.
        for (let i = 1; i <= num; i++) {
            const tempPatrimonio = masterAsset.patrimonio ? `${masterAsset.patrimonio}-${i}` : null;
            const tempSerial = masterAsset.serial_number ? `${masterAsset.serial_number}-${i}` : null;
            
            values.push([
                tempPatrimonio,
                masterAsset.name,
                masterAsset.model,
                tempSerial,
                masterAsset.status || 'available',
                masterAsset.calibration_validity
            ]);
        }

        await db.query(`
            INSERT INTO sgq_assets (patrimonio, name, model, serial_number, status, calibration_validity)
            VALUES ?
        `, [values]);

        res.status(201).json({ message: `${num} ativos clonados com sucesso.` });
    } catch (error) {
        console.error('Erro na clonagem de ativos:', error);
        res.status(500).json({ error: 'Erro interno na clonagem de ativos.' });
    }
});

// PUT /api/sgq/assets/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { patrimonio, name, model, serial_number, status, calibration_validity, alerts, requires_calibration, stock_quantity, user_name } = req.body;

        if (patrimonio && requires_calibration !== false) {
            const [existing] = await db.query('SELECT id FROM sgq_assets WHERE patrimonio = ? AND id != ?', [patrimonio, id]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Já existe outro ativo cadastrado com este patrimônio.' });
            }
        }

        // Não atualizamos o stock_quantity via PUT genérico para preservar o histórico. O endpoint de /transaction gerencia isso.
        const rc = requires_calibration === undefined ? true : Boolean(requires_calibration);

        await db.query(`
            UPDATE sgq_assets 
            SET patrimonio = ?, name = ?, model = ?, serial_number = ?, status = ?, calibration_validity = ?, requires_calibration = ?
            WHERE id = ?
        `, [patrimonio, name, model, serial_number, status, calibration_validity, rc, id]);
        
        // Atualizar alertas
        if (alerts && Array.isArray(alerts)) {
            await db.query('DELETE FROM sgq_asset_alerts WHERE asset_id = ?', [id]);
            if (alerts.length > 0) {
                const values = alerts.map(a => [
                    id, 
                    a.days_before, 
                    a.notify_email ? 1 : 0, 
                    a.notify_whatsapp ? 1 : 0, 
                    JSON.stringify(a.target_users || [])
                ]);
                await db.query(`
                    INSERT INTO sgq_asset_alerts (asset_id, days_before, notify_email, notify_whatsapp, target_users)
                    VALUES ?
                `, [values]);
            }
        }
        
        res.json({ message: 'Ativo atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar ativo:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar ativo.' });
    }
});

// DELETE /api/sgq/assets/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM sgq_assets WHERE id = ?', [id]);
        res.json({ message: 'Ativo removido com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar ativo:', error);
        res.status(500).json({ error: 'Erro interno ao deletar ativo.' });
    }
});

// POST /api/sgq/assets/:id/transactions
router.get('/:id/transactions', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sgq_asset_transactions WHERE asset_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json(rows);
    } catch(err) { res.status(500).json({error: 'Erro interno.'}) }
});

// POST /api/sgq/assets/:id/transaction (Quick stock adjustment)
router.post('/:id/transaction', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, quantity, user_name, reason } = req.body;
        
        const q = parseInt(quantity, 10);
        if (isNaN(q) || q <= 0) return res.status(400).json({ error: 'Quantidade inválida.' });
        if (!['entrada', 'baixa'].includes(type)) return res.status(400).json({ error: 'Tipo de transação inválido.' });

        const [assets] = await db.query('SELECT stock_quantity, requires_calibration FROM sgq_assets WHERE id = ?', [id]);
        if (assets.length === 0) return res.status(404).json({ error: 'Ativo não encontrado.' });
        
        const asset = assets[0];
        if (asset.requires_calibration) {
            return res.status(400).json({ error: 'Ativos rastreáveis com calibração não suportam ajuste de estoque.' });
        }

        let newStock = asset.stock_quantity;
        if (type === 'entrada') newStock += q;
        else if (type === 'baixa') newStock -= q;

        if (newStock < 0) return res.status(400).json({ error: 'Saldo de estoque insuficiente para realizar a baixa.' });

        await db.query('UPDATE sgq_assets SET stock_quantity = ? WHERE id = ?', [newStock, id]);
        await db.query(`
            INSERT INTO sgq_asset_transactions (asset_id, type, quantity, user_name, reason)
            VALUES (?, ?, ?, ?, ?)
        `, [id, type, q, user_name || 'Sistema', reason || '']);

        res.json({ message: `Transação de ${type} realizada com sucesso. Novo saldo: ${newStock}`, newStock });
    } catch (error) {
        console.error('Erro ao registrar transação:', error);
        res.status(500).json({ error: 'Erro interno ao registrar transação.' });
    }
});

// POST /api/sgq/assets/alerts/apply-all
router.post('/alerts/apply-all', async (req, res) => {
    try {
        const { alerts } = req.body;
        
        const [assets] = await db.query('SELECT id FROM sgq_assets');
        
        if (assets.length === 0) {
            return res.status(400).json({ error: 'Nenhum ativo cadastrado.' });
        }
        
        await db.query('DELETE FROM sgq_asset_alerts');
        
        if (alerts && Array.isArray(alerts) && alerts.length > 0) {
            const values = [];
            assets.forEach(asset => {
                alerts.forEach(a => {
                    values.push([
                        asset.id, 
                        a.days_before, 
                        a.notify_email ? 1 : 0, 
                        a.notify_whatsapp ? 1 : 0, 
                        JSON.stringify(a.target_users || [])
                    ]);
                });
            });
            
            if (values.length > 0) {
                await db.query(`
                    INSERT INTO sgq_asset_alerts (asset_id, days_before, notify_email, notify_whatsapp, target_users)
                    VALUES ?
                `, [values]);
            }
        }
        
        res.json({ message: 'Regras aplicadas a todos os ativos!' });
    } catch (error) {
        console.error('Erro ao aplicar alertas em lote:', error);
        res.status(500).json({ error: 'Erro interno ao aplicar alertas.' });
    }
});

// GET /api/sgq/assets/:id/alerts
router.get('/:id/alerts', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM sgq_asset_alerts WHERE asset_id = ? ORDER BY days_before DESC', [id]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar alertas:', error);
        res.status(500).json({ error: 'Erro interno ao consultar alertas.' });
    }
});

// GET /api/sgq/assets/:id/attachments
router.get('/:id/attachments', async (req, res) => {
    try {
        const { id } = req.params;
        // Do not select file_data to save bandwidth
        const [rows] = await db.query('SELECT id, asset_id, file_type, mime_type, original_name, is_main, created_at FROM sgq_asset_attachments WHERE asset_id = ? ORDER BY id DESC', [id]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar anexos:', error);
        res.status(500).json({ error: 'Erro interno ao consultar anexos.' });
    }
});

// GET /api/sgq/assets/attachments/:attachmentId/download
router.get('/attachments/:attachmentId/download', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        let query = 'SELECT file_data, mime_type, original_name';
        try {
            await db.query('SELECT file_path FROM sgq_asset_attachments LIMIT 1');
            query += ', file_path';
        } catch (e) {
            // column doesn't exist yet
        }
        query += ' FROM sgq_asset_attachments WHERE id = ?';
        
        const [rows] = await db.query(query, [attachmentId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Anexo não encontrado.' });
        }

        const attachment = rows[0];

        if (attachment.file_path) {
            const fs = require('fs');
            const path = require('path');
            const relativePath = attachment.file_path.replace(/^\//, '');
            const fullPath = path.join(__dirname, '..', relativePath);
            if (fs.existsSync(fullPath)) {
                return res.sendFile(fullPath);
            }
        }

        if (attachment.file_data) {
            res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
            res.setHeader('Content-Disposition', `inline; filename="${attachment.original_name}"`);
            return res.send(attachment.file_data);
        }

        return res.status(404).json({ error: 'Arquivo não encontrado.' });
    } catch (error) {
        console.error('Erro ao fazer download do anexo:', error);
        res.status(500).json({ error: 'Erro interno ao fazer download.' });
    }
});

// POST /api/sgq/assets/:id/attachments
router.post('/:id/attachments', memoryUpload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'pdfs', maxCount: 10 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const { mainPhotoName } = req.body;
        
        // Verifica se já existe uma foto principal
        const [existing] = await db.query('SELECT id FROM sgq_asset_attachments WHERE asset_id = ? AND file_type = "photo"', [id]);
        let hasMain = false;
        if (existing.length > 0) {
            const [mains] = await db.query('SELECT id FROM sgq_asset_attachments WHERE asset_id = ? AND file_type = "photo" AND is_main = TRUE', [id]);
            hasMain = mains.length > 0;
        }

        // Se uma das novas fotos for marcada como principal, remove is_main das antigas
        let willSetNewMain = req.files['photos'] && req.files['photos'].some((f, idx) => 
            f.originalname === mainPhotoName || (!hasMain && idx === 0 && !mainPhotoName)
        );

        if (willSetNewMain && hasMain) {
            await db.query('UPDATE sgq_asset_attachments SET is_main = FALSE WHERE asset_id = ? AND file_type = "photo"', [id]);
        }
        
        try {
            await db.query('ALTER TABLE sgq_asset_attachments ADD COLUMN file_path VARCHAR(255)');
        } catch (e) {}

        const insertPromises = [];
        const fs = require('fs');
        const path = require('path');

        const uploadDirPhotos = path.join(__dirname, '../uploads/fotos');
        const uploadDirPdfs = path.join(__dirname, '../uploads/certificados');
        if (!fs.existsSync(uploadDirPhotos)) fs.mkdirSync(uploadDirPhotos, { recursive: true });
        if (!fs.existsSync(uploadDirPdfs)) fs.mkdirSync(uploadDirPdfs, { recursive: true });

        if (req.files['photos']) {
            req.files['photos'].forEach((file, idx) => {
                let isMain = false;
                if (file.originalname === mainPhotoName) isMain = true;
                else if (!hasMain && !mainPhotoName && idx === 0 && existing.length === 0) isMain = true;

                const fileName = `asset-${id}-${Date.now()}-${file.originalname}`;
                const filePath = path.join(uploadDirPhotos, fileName);
                fs.writeFileSync(filePath, file.buffer);
                const fileUrl = `/uploads/fotos/${fileName}`;

                const promise = db.query(`
                    INSERT INTO sgq_asset_attachments (asset_id, file_type, mime_type, file_path, original_name, is_main)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [id, 'photo', file.mimetype, fileUrl, file.originalname, isMain]);
                insertPromises.push(promise);
            });
        }
        
        if (req.files['pdfs']) {
            req.files['pdfs'].forEach(file => {
                const fileName = `asset-${id}-${Date.now()}-${file.originalname}`;
                const filePath = path.join(uploadDirPdfs, fileName);
                fs.writeFileSync(filePath, file.buffer);
                const fileUrl = `/uploads/certificados/${fileName}`;

                const promise = db.query(`
                    INSERT INTO sgq_asset_attachments (asset_id, file_type, mime_type, file_path, original_name, is_main)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [id, 'pdf', file.mimetype, fileUrl, file.originalname, false]);
                insertPromises.push(promise);
            });
        }

        if (insertPromises.length > 0) {
            await Promise.all(insertPromises);
        }

        res.status(201).json({ message: 'Anexos salvos no banco de dados com sucesso.' });
    } catch (error) {
        console.error('Erro ao fazer upload de anexos:', error);
        res.status(500).json({ error: 'Erro interno ao fazer upload.' });
    }
});

// PUT /api/sgq/assets/attachments/:attachmentId/main
router.put('/attachments/:attachmentId/main', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        
        // Obter asset_id do anexo
        const [rows] = await db.query('SELECT asset_id FROM sgq_asset_attachments WHERE id = ? AND file_type = "photo"', [attachmentId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Foto não encontrada.' });
        
        const assetId = rows[0].asset_id;

        // Remover is_main de todas as fotos deste ativo
        await db.query('UPDATE sgq_asset_attachments SET is_main = FALSE WHERE asset_id = ? AND file_type = "photo"', [assetId]);
        
        // Definir is_main = TRUE para a foto selecionada
        await db.query('UPDATE sgq_asset_attachments SET is_main = TRUE WHERE id = ?', [attachmentId]);

        res.json({ message: 'Foto principal atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar foto principal:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar foto principal.' });
    }
});

// DELETE /api/sgq/assets/attachments/:attachmentId
router.delete('/attachments/:attachmentId', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        await db.query('DELETE FROM sgq_asset_attachments WHERE id = ?', [attachmentId]);
        res.json({ message: 'Anexo removido com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar anexo:', error);
        res.status(500).json({ error: 'Erro interno ao deletar anexo.' });
    }
});

// === CAIXAS DE FERRAMENTAS (TOOLBOXES) ===

router.get('/toolboxes', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sgq_toolboxes ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar toolboxes.' });
    }
});

router.post('/toolboxes', async (req, res) => {
    try {
        const { name, employee_cpf } = req.body;
        
        const [existing] = await db.query('SELECT id FROM sgq_toolboxes WHERE name = ?', [name]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Já existe uma caixa de ferramentas cadastrada com este nome.' });
        }

        const [result] = await db.query(`
            INSERT INTO sgq_toolboxes (name, employee_cpf)
            VALUES (?, ?)
        `, [name, employee_cpf]);
        res.status(201).json({ message: 'Caixa criada com sucesso.', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar caixa.' });
    }
});

// Editar caixa
router.put('/toolboxes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, employee_cpf } = req.body;
        
        const [existing] = await db.query('SELECT id FROM sgq_toolboxes WHERE name = ? AND id != ?', [name, id]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Já existe uma caixa de ferramentas cadastrada com este nome.' });
        }

        await db.query(`
            UPDATE sgq_toolboxes SET name = ?, employee_cpf = ? WHERE id = ?
        `, [name, employee_cpf, id]);
        res.json({ message: 'Caixa atualizada com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar caixa.' });
    }
});

// Excluir caixa
router.delete('/toolboxes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM sgq_toolboxes WHERE id = ?', [id]);
        res.json({ message: 'Caixa removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover caixa.' });
    }
});

// Relacionamento (Assign Asset to Toolbox)
router.post('/assign', async (req, res) => {
    try {
        const { asset_id, toolbox_id, quantity, user_name } = req.body;
        const q = parseInt(quantity || 1, 10);

        const [assets] = await db.query('SELECT requires_calibration, stock_quantity FROM sgq_assets WHERE id = ?', [asset_id]);
        if (assets.length === 0) return res.status(404).json({ error: 'Ativo não encontrado.' });
        
        const asset = assets[0];

        if (!asset.requires_calibration) {
            if (asset.stock_quantity < q) {
                return res.status(400).json({ error: 'Estoque insuficiente para atribuir a quantidade solicitada.' });
            }

            // Deduct stock and insert transaction
            await db.query('UPDATE sgq_assets SET stock_quantity = stock_quantity - ? WHERE id = ?', [q, asset_id]);
            await db.query(`
                INSERT INTO sgq_asset_transactions (asset_id, type, quantity, user_name, reason, toolbox_id)
                VALUES (?, 'caixa_adicionar', ?, ?, 'Atribuído à Caixa', ?)
            `, [asset_id, q, user_name || 'Sistema', toolbox_id]);
            
            // Insert or update relation
            await db.query(`
                INSERT INTO sgq_asset_toolbox (asset_id, toolbox_id, quantity)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), assigned_at = CURRENT_TIMESTAMP
            `, [asset_id, toolbox_id, q]);

        } else {
            // Normal unique asset logic
            await db.query(`
                INSERT INTO sgq_asset_toolbox (asset_id, toolbox_id, quantity)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE assigned_at = CURRENT_TIMESTAMP
            `, [asset_id, toolbox_id]);
            
            await db.query(`UPDATE sgq_assets SET status = 'in_use' WHERE id = ?`, [asset_id]);
            await db.query(`
                INSERT INTO sgq_asset_transactions (asset_id, type, quantity, user_name, reason, toolbox_id)
                VALUES (?, 'caixa_adicionar', 1, ?, 'Atribuído à Caixa', ?)
            `, [asset_id, user_name || 'Sistema', toolbox_id]);
        }
        
        res.json({ message: 'Ativo atribuído à caixa com sucesso.' });
    } catch (error) {
        console.error('Erro ao atribuir ativo:', error);
        res.status(500).json({ error: 'Erro ao atribuir ativo à caixa.' });
    }
});

// Remover ativo da caixa
router.delete('/assign/:toolbox_id/:asset_id', async (req, res) => {
    try {
        const { toolbox_id, asset_id } = req.params;
        const { user_name } = req.query;

        const [relations] = await db.query('SELECT quantity FROM sgq_asset_toolbox WHERE toolbox_id = ? AND asset_id = ?', [toolbox_id, asset_id]);
        if (relations.length === 0) return res.status(404).json({ error: 'Relação não encontrada.' });
        const assignedQty = relations[0].quantity || 1;

        const [assets] = await db.query('SELECT requires_calibration FROM sgq_assets WHERE id = ?', [asset_id]);
        const asset = assets[0];

        await db.query('DELETE FROM sgq_asset_toolbox WHERE toolbox_id = ? AND asset_id = ?', [toolbox_id, asset_id]);
        
        if (asset && !asset.requires_calibration) {
            // Return stock and log transaction
            await db.query('UPDATE sgq_assets SET stock_quantity = stock_quantity + ? WHERE id = ?', [assignedQty, asset_id]);
            await db.query(`
                INSERT INTO sgq_asset_transactions (asset_id, type, quantity, user_name, reason, toolbox_id)
                VALUES (?, 'caixa_remover', ?, ?, 'Removido da Caixa', ?)
            `, [asset_id, assignedQty, user_name || 'Sistema', toolbox_id]);
        } else if (asset) {
            // Return status to available
            await db.query(`UPDATE sgq_assets SET status = 'available' WHERE id = ?`, [asset_id]);
            await db.query(`
                INSERT INTO sgq_asset_transactions (asset_id, type, quantity, user_name, reason, toolbox_id)
                VALUES (?, 'caixa_remover', 1, ?, 'Removido da Caixa', ?)
            `, [asset_id, user_name || 'Sistema', toolbox_id]);
        }
        
        res.json({ message: 'Ativo removido da caixa com sucesso.' });
    } catch (error) {
        console.error('Erro ao remover da caixa:', error);
        res.status(500).json({ error: 'Erro ao remover ativo da caixa.' });
    }
});

// Listar todos os ativos de TODAS as caixas (Para Inspeção Geral)
router.get('/toolboxes/all/assets', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                a.id, a.patrimonio, a.name, a.model, a.serial_number, a.status, a.calibration_validity, a.requires_calibration,
                t.assigned_at, t.quantity as assigned_quantity,
                tb.name as toolbox_name, tb.employee_cpf
            FROM sgq_assets a
            JOIN sgq_asset_toolbox t ON a.id = t.asset_id
            JOIN sgq_toolboxes tb ON t.toolbox_id = tb.id
            ORDER BY tb.name ASC, a.name ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar ativos de todas as caixas:', error);
        res.status(500).json({ error: 'Erro ao buscar ativos de todas as caixas.' });
    }
});

// Listar ativos de uma caixa
router.get('/toolboxes/:id/assets', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT a.*, t.assigned_at, t.quantity as assigned_quantity,
                   (SELECT id FROM sgq_asset_attachments WHERE asset_id = a.id AND file_type = 'photo' AND is_main = TRUE LIMIT 1) as main_photo_id
            FROM sgq_assets a
            JOIN sgq_asset_toolbox t ON a.id = t.asset_id
            WHERE t.toolbox_id = ?
            ORDER BY t.assigned_at DESC
        `, [id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar ativos da caixa.' });
    }
});

// Listar ativos DEVOLVIDOS de uma caixa (histórico de remoção)
router.get('/toolboxes/:id/returned', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT t.id as transaction_id, t.created_at as returned_at, t.quantity as returned_quantity, t.user_name,
                   a.id, a.patrimonio, a.name, a.model, a.serial_number, a.requires_calibration
            FROM sgq_asset_transactions t
            JOIN sgq_assets a ON t.asset_id = a.id
            WHERE t.toolbox_id = ? AND t.type = 'caixa_remover'
            ORDER BY t.created_at DESC
        `, [id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar ativos devolvidos da caixa.' });
    }
});

// Gerar PDF da caixa
router.get('/toolboxes/:id/pdf', async (req, res) => {
    try {
        const { id } = req.params;
        const pdfBytes = await generateToolboxReport(id, { usuarioGerador: req.query.user_name });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="caixa_${id}_termo.pdf"`);
        res.send(pdfBytes);
    } catch (error) {
        console.error('Erro ao gerar PDF da caixa:', error);
        res.status(500).json({ error: 'Erro ao gerar PDF da caixa.' });
    }
});

// Listar ativos por funcionário (Offboarding/RH)
router.get('/employee/:cpfOrId', async (req, res) => {
    try {
        const { cpfOrId } = req.params;
        const [rows] = await db.query(`
            SELECT a.*, t.assigned_at, tb.name as toolbox_name,
                   (SELECT id FROM sgq_asset_attachments WHERE asset_id = a.id AND file_type = 'photo' AND is_main = TRUE LIMIT 1) as main_photo_id
            FROM sgq_assets a
            JOIN sgq_asset_toolbox t ON a.id = t.asset_id
            JOIN sgq_toolboxes tb ON t.toolbox_id = tb.id
            WHERE tb.employee_cpf = ?
            ORDER BY t.assigned_at DESC
        `, [cpfOrId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar ativos do funcionário.' });
    }
});

// === CALIBRAÇÃO ===

router.get('/calibrations', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sgq_calibrations ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar histórico de calibração.' });
    }
});

router.post('/calibrations/upload/:assetId', upload.single('certificate'), async (req, res) => {
    try {
        const { assetId } = req.params;
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        
        const certificateUrl = `/uploads/certificados/${req.file.filename}`;
        
        await db.query(`
            INSERT INTO sgq_calibrations (asset_id, certificate_url, date_returned)
            VALUES (?, ?, CURRENT_DATE)
        `, [assetId, certificateUrl]);

        // Atualizar status do ativo para disponivel
        await db.query(`UPDATE sgq_assets SET status = 'available' WHERE id = ?`, [assetId]);

        res.json({ message: 'Certificado anexado com sucesso.', url: certificateUrl });
    } catch (error) {
        console.error('Erro no upload de certificado:', error);
        res.status(500).json({ error: 'Erro interno ao realizar upload.' });
    }
});

module.exports = router;
