const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/certificados');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Memória para receber o PDF do Romaneio e mandar por e-mail
const uploadMemory = multer({ storage: multer.memoryStorage() });

// GET /api/sgq/romaneios
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, 
                (SELECT COUNT(*) FROM sgq_romaneios_items WHERE romaneio_id = r.id) as total_itens,
                f.nome as fornecedor_nome
            FROM sgq_romaneios r 
            LEFT JOIN sgq_fornecedores f ON r.fornecedor_id = f.id
            ORDER BY r.id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar romaneios do SGQ:', error);
        res.status(500).json({ error: 'Erro interno ao buscar romaneios.' });
    }
});

// GET /api/sgq/romaneios/:id
router.get('/:id', async (req, res) => {
    try {
        const [romaneios] = await db.query(`
            SELECT r.*, f.nome as fornecedor_nome, f.email as fornecedor_email, f.telefone as fornecedor_telefone
            FROM sgq_romaneios r
            LEFT JOIN sgq_fornecedores f ON r.fornecedor_id = f.id
            WHERE r.id = ?
        `, [req.params.id]);
        
        if (romaneios.length === 0) return res.status(404).json({ error: 'Romaneio não encontrado.' });
        
        const [items] = await db.query(`
            SELECT i.id as item_romaneio_id, i.status as item_status, i.data_retorno, i.certificado_url, a.* 
            FROM sgq_romaneios_items i
            JOIN sgq_assets a ON i.asset_id = a.id
            WHERE i.romaneio_id = ?
        `, [req.params.id]);

        res.json({ ...romaneios[0], items });
    } catch (error) {
        console.error('Erro ao buscar detalhes do romaneio SGQ:', error);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// POST /api/sgq/romaneios
router.post('/', async (req, res) => {
    try {
        const { data_envio, previsao_retorno, fornecedor_id, destinatario, responsavel, observacao } = req.body;
        
        const [last] = await db.query('SELECT id FROM sgq_romaneios ORDER BY id DESC LIMIT 1');
        const nextId = last.length > 0 ? last[0].id + 1 : 1;
        const numero = `ROM-SGQ-${nextId.toString().padStart(3, '0')}`;

        const [result] = await db.query(`
            INSERT INTO sgq_romaneios (numero, data_envio, previsao_retorno, fornecedor_id, destinatario, responsavel, observacao, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'aberto')
        `, [numero, data_envio, previsao_retorno, fornecedor_id || null, destinatario, responsavel, observacao]);

        res.status(201).json({ message: 'Romaneio criado com sucesso', id: result.insertId });
    } catch (error) {
        console.error('Erro ao criar romaneio SGQ:', error);
        res.status(500).json({ error: 'Erro interno ao criar romaneio.' });
    }
});

// PUT /api/sgq/romaneios/:id
router.put('/:id', async (req, res) => {
    try {
        const { data_envio, previsao_retorno, fornecedor_id, destinatario, responsavel, observacao, status } = req.body;
        
        await db.query(`
            UPDATE sgq_romaneios 
            SET data_envio = ?, previsao_retorno = ?, fornecedor_id = ?, destinatario = ?, responsavel = ?, observacao = ?, status = ?
            WHERE id = ?
        `, [data_envio, previsao_retorno, fornecedor_id || null, destinatario, responsavel, observacao, status || 'aberto', req.params.id]);

        res.json({ message: 'Romaneio atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar romaneio SGQ:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar romaneio.' });
    }
});

// POST /api/sgq/romaneios/:id/items
router.post('/:id/items', async (req, res) => {
    try {
        const { asset_ids } = req.body;
        const romaneioId = req.params.id;

        if (!asset_ids || asset_ids.length === 0) return res.status(400).json({ error: 'Nenhum ativo selecionado.' });

        for (const assetId of asset_ids) {
            await db.query('INSERT INTO sgq_romaneios_items (romaneio_id, asset_id, status) VALUES (?, ?, ?)', [romaneioId, assetId, 'enviado']);
            await db.query("UPDATE sgq_assets SET status = 'maintenance' WHERE id = ?", [assetId]);
        }

        res.status(201).json({ message: 'Itens adicionados com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar itens ao romaneio SGQ:', error);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// DELETE /api/sgq/romaneios/:id/items/:itemId
router.delete('/:id/items/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const [itemRow] = await db.query('SELECT asset_id FROM sgq_romaneios_items WHERE id = ?', [itemId]);
        
        if (itemRow.length > 0) {
            await db.query("UPDATE sgq_assets SET status = 'available' WHERE id = ?", [itemRow[0].asset_id]);
            await db.query('DELETE FROM sgq_romaneios_items WHERE id = ?', [itemId]);
        }

        res.json({ message: 'Item removido do romaneio.' });
    } catch (error) {
        console.error('Erro ao remover item do romaneio SGQ:', error);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// PUT /api/sgq/romaneios/:id/items/:itemId/retorno
router.put('/:id/items/:itemId/retorno', upload.single('certificado'), async (req, res) => {
    try {
        const { itemId } = req.params;
        const { validade_calibracao, observacao } = req.body;
        const file = req.file;

        const [itemRow] = await db.query('SELECT asset_id FROM sgq_romaneios_items WHERE id = ?', [itemId]);
        if (itemRow.length === 0) return res.status(404).json({ error: 'Item não encontrado no romaneio.' });

        const assetId = itemRow[0].asset_id;
        let fileUrl = null;

        if (file) {
            fileUrl = `/uploads/certificados/${file.filename}`;
            
            // Adicionar ao histórico de calibrações do ativo
            await db.query(`
                INSERT INTO sgq_calibrations (asset_id, certificate_url, date_returned)
                VALUES (?, ?, CURRENT_DATE)
            `, [assetId, fileUrl]);
        }

        try {
            await db.query('ALTER TABLE sgq_romaneios_items ADD COLUMN observacao_retorno TEXT');
        } catch (e) {
            // Ignora erro se coluna já existir
        }

        await db.query(`
            UPDATE sgq_romaneios_items 
            SET status = 'retornado', data_retorno = NOW(), certificado_url = COALESCE(?, certificado_url), observacao_retorno = ?
            WHERE id = ?
        `, [fileUrl, observacao || null, itemId]);

        await db.query(`
            UPDATE sgq_assets 
            SET status = 'available', calibration_validity = ?
            WHERE id = ?
        `, [validade_calibracao || null, assetId]);

        res.json({ message: 'Item retornado com sucesso.' });
    } catch (error) {
        console.error('Erro ao retornar item SGQ:', error);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// DELETE /api/sgq/romaneios/:id
router.delete('/:id', async (req, res) => {
    try {
        const [items] = await db.query('SELECT asset_id FROM sgq_romaneios_items WHERE romaneio_id = ?', [req.params.id]);
        for (const item of items) {
            await db.query("UPDATE sgq_assets SET status = 'available' WHERE id = ?", [item.asset_id]);
        }
        await db.query('DELETE FROM sgq_romaneios_items WHERE romaneio_id = ?', [req.params.id]);
        await db.query('DELETE FROM sgq_romaneios WHERE id = ?', [req.params.id]);

        res.json({ message: 'Romaneio excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir romaneio SGQ:', error);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// POST /api/sgq/romaneios/:id/send-email
router.post('/:id/send-email', uploadMemory.single('pdf'), async (req, res) => {
    try {
        const { id } = req.params;
        const file = req.file;
        const { email } = req.body;

        if (!file || !email) return res.status(400).json({ error: 'PDF e email são obrigatórios.' });

        const nodemailer = require('nodemailer');
        const { getCorporateEmailTemplate } = require('../utils/emailTemplate');
        
        const SMTP_CONFIG = {
            host: 'smtp.task.com.br',
            port: 587,
            secure: false,
            auth: {
                user: 'sincometal@metalfisa.com.br',
                pass: 'Pro1042@sm'
            },
            tls: { rejectUnauthorized: false }
        };

        const transporter = nodemailer.createTransport(SMTP_CONFIG);

        const htmlContent = `
            <h2>Romaneio de Calibração</h2>
            <p>Olá,</p>
            <p>Segue em anexo o romaneio de calibração enviado pela MetalFisa.</p>
            <p>Por favor, acuse o recebimento.</p>
        `;

        const mailOptions = {
            from: '"MetalFisa SGQ" <sincometal@metalfisa.com.br>',
            to: email,
            subject: `MetalFisa - Romaneio SGQ #${id}`,
            html: getCorporateEmailTemplate(htmlContent),
            attachments: [{
                filename: `Romaneio_SGQ_${id}.pdf`,
                content: file.buffer
            }]
        };

        await transporter.sendMail(mailOptions);
        
        await db.query('UPDATE sgq_romaneios SET email_enviado = 1 WHERE id = ?', [id]);

        res.json({ message: 'E-mail enviado com sucesso.' });
    } catch (error) {
        console.error('Erro ao enviar email do Romaneio SGQ:', error);
        res.status(500).json({ error: 'Erro ao enviar e-mail: ' + error.message });
    }
});

module.exports = router;
