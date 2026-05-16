const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
        const { patrimonio, name, model, serial_number, status, calibration_validity, alerts } = req.body;

        if (patrimonio) {
            const [existing] = await db.query('SELECT id FROM sgq_assets WHERE patrimonio = ?', [patrimonio]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Já existe um ativo cadastrado com este patrimônio.' });
            }
        }

        const [result] = await db.query(`
            INSERT INTO sgq_assets (patrimonio, name, model, serial_number, status, calibration_validity)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [patrimonio, name, model, serial_number, status || 'available', calibration_validity]);
        
        const assetId = result.insertId;

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
        const { patrimonio, name, model, serial_number, status, calibration_validity, alerts } = req.body;

        if (patrimonio) {
            const [existing] = await db.query('SELECT id FROM sgq_assets WHERE patrimonio = ? AND id != ?', [patrimonio, id]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Já existe outro ativo cadastrado com este patrimônio.' });
            }
        }

        await db.query(`
            UPDATE sgq_assets 
            SET patrimonio = ?, name = ?, model = ?, serial_number = ?, status = ?, calibration_validity = ?
            WHERE id = ?
        `, [patrimonio, name, model, serial_number, status, calibration_validity, id]);
        
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
        const [rows] = await db.query('SELECT file_data, mime_type, original_name FROM sgq_asset_attachments WHERE id = ?', [attachmentId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Anexo não encontrado.' });
        }

        const file = rows[0];
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        res.send(file.file_data);
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
        
        const insertPromises = [];

        if (req.files['photos']) {
            req.files['photos'].forEach((file, idx) => {
                let isMain = false;
                if (file.originalname === mainPhotoName) isMain = true;
                else if (!hasMain && !mainPhotoName && idx === 0 && existing.length === 0) isMain = true;

                const promise = db.query(`
                    INSERT INTO sgq_asset_attachments (asset_id, file_type, mime_type, file_data, original_name, is_main)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [id, 'photo', file.mimetype, file.buffer, file.originalname, isMain]);
                insertPromises.push(promise);
            });
        }
        
        if (req.files['pdfs']) {
            req.files['pdfs'].forEach(file => {
                const promise = db.query(`
                    INSERT INTO sgq_asset_attachments (asset_id, file_type, mime_type, file_data, original_name, is_main)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [id, 'pdf', file.mimetype, file.buffer, file.originalname, false]);
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
        const { asset_id, toolbox_id } = req.body;
        await db.query(`
            INSERT INTO sgq_asset_toolbox (asset_id, toolbox_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE assigned_at = CURRENT_TIMESTAMP
        `, [asset_id, toolbox_id]);
        
        // Update asset status to 'in_use'
        await db.query(`UPDATE sgq_assets SET status = 'in_use' WHERE id = ?`, [asset_id]);
        
        res.json({ message: 'Ativo atribuído à caixa com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atribuir ativo à caixa.' });
    }
});

// Remover ativo da caixa
router.delete('/assign/:toolbox_id/:asset_id', async (req, res) => {
    try {
        const { toolbox_id, asset_id } = req.params;
        await db.query('DELETE FROM sgq_asset_toolbox WHERE toolbox_id = ? AND asset_id = ?', [toolbox_id, asset_id]);
        
        // Return status to available
        await db.query(`UPDATE sgq_assets SET status = 'available' WHERE id = ?`, [asset_id]);
        
        res.json({ message: 'Ativo removido da caixa com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover ativo da caixa.' });
    }
});

// Listar ativos de uma caixa
router.get('/toolboxes/:id/assets', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT a.*, t.assigned_at,
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
