/**
 * labels.js — Rota /api/labels
 * Sistema de impressão de etiquetas PPLB/EPL2
 *
 * Endpoints:
 *   GET  /api/labels/config          → Busca configuração salva (impressora + layout)
 *   PUT  /api/labels/config          → Salva configuração
 *   POST /api/labels/logo            → Upload e processamento da logo
 *   POST /api/labels/test-connection → Testa conectividade com a impressora
 *   POST /api/labels/preview         → Gera preview HTML/SVG da etiqueta (sem imprimir)
 *   POST /api/labels/print           → Imprime etiquetas para os itens selecionados
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const sharp    = require('sharp');
const fs       = require('fs');
const path     = require('path');
const db       = require('../services/mysqlService'); // Mudou para MySQL
const { processImageToGW } = require('../services/imageProcessor');
const { buildLabel, buildFields, calculateCopies } = require('../services/pplbEngine');
const { sendRaw, testConnection, DEFAULT_PORT }    = require('../services/rawPrinter');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Setup da tabela (cria se não existir) ─────────────────────────────────────
async function ensureTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS label_config (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            printer_mode   VARCHAR(10)  DEFAULT 'tcp',
            printer_host   VARCHAR(100) DEFAULT '127.0.0.1',
            printer_port   INTEGER      DEFAULT 9100,
            print_offset_x INTEGER      DEFAULT 0,
            print_offset_y INTEGER      DEFAULT 0,
            logo_base64    LONGTEXT,
            logo_width     INTEGER,
            logo_height    INTEGER,
            logo_bytes_row INTEGER,
            logo_bitmap    LONGTEXT,
            label_fields   LONGTEXT,
            updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    // Migração segura: adiciona colunas de offset somente se não existirem
    const [cols] = await db.query(`SHOW COLUMNS FROM label_config LIKE 'print_offset_x'`);
    if (cols.length === 0) {
        await db.query(`ALTER TABLE label_config ADD COLUMN print_offset_x INTEGER DEFAULT 0`);
        await db.query(`ALTER TABLE label_config ADD COLUMN print_offset_y INTEGER DEFAULT 0`);
    }
    const [colsName] = await db.query(`SHOW COLUMNS FROM label_config LIKE 'name'`);
    if (colsName.length === 0) {
        await db.query(`ALTER TABLE label_config ADD COLUMN name VARCHAR(255) DEFAULT 'Modelo Padrão'`);
    }
    const [colsIsDefault] = await db.query(`SHOW COLUMNS FROM label_config LIKE 'is_default'`);
    if (colsIsDefault.length === 0) {
        await db.query(`ALTER TABLE label_config ADD COLUMN is_default BOOLEAN DEFAULT FALSE`);
        try {
            const [first] = await db.query(`SELECT id FROM label_config ORDER BY id LIMIT 1`);
            if (first.length > 0) {
                await db.query(`UPDATE label_config SET is_default = 1 WHERE id = ?`, [first[0].id]);
            }
        } catch (e) {
            console.error('[Labels] Failed to set default label:', e);
        }
    }
    // Garante que existe pelo menos 1 registro
    const [rows] = await db.query('SELECT id FROM label_config LIMIT 1');
    if (rows.length === 0) {
        await db.query(`INSERT INTO label_config (label_fields) VALUES (?)`, [JSON.stringify([
            { label: 'Pedido: ',    dataKey: 'pedido' },
            { label: 'Produto: ',   dataKey: 'produto' },
            { label: 'Desc: ',      dataKey: 'descricao' },
            { label: 'Qtd: ',       dataKey: 'quantidade' },
            { label: 'Entrega: ',   dataKey: 'data_entrega' },
        ])]);
    }
}
ensureTable().catch(e => console.error('[Labels] Erro ao criar tabela label_config no MySQL:', e));

// ── GET /api/labels/config ────────────────────────────────────────────────────
router.get('/config', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, name, is_default, printer_mode, printer_host, printer_port, print_offset_x, print_offset_y, logo_base64, logo_width, logo_height, label_fields FROM label_config ORDER BY is_default DESC, id ASC'
        );
        if (rows.length === 0) return res.json({ ok: true, config: null, configs: [] });
        
        const configs = rows.map(r => {
            let fields = [];
            if (typeof r.label_fields === 'string') {
                try { fields = JSON.parse(r.label_fields); } catch(e){}
            } else {
                fields = r.label_fields || [];
            }
            return { ...r, label_fields: fields };
        });

        res.json({ ok: true, config: configs[0], configs });
    } catch (err) {
        console.error('[Labels] GET /config:', err);
        res.status(500).json({ error: 'Erro ao buscar configuração de etiqueta' });
    }
});

// ── PUT /api/labels/config ────────────────────────────────────────────────────
router.put('/config', async (req, res) => {
    try {
        let { id, name, is_default, printer_mode, printer_host, printer_port, print_offset_x, print_offset_y, label_fields } = req.body;

        if (!id) {
            // Fallback: se não enviou ID, tenta atualizar o modelo padrão
            const [rows] = await db.query('SELECT id FROM label_config ORDER BY is_default DESC, id ASC LIMIT 1');
            if (rows.length > 0) {
                id = rows[0].id;
            } else {
                return res.status(400).json({ error: 'Nenhuma configuração existente para atualizar. Crie um modelo primeiro.' });
            }
        }

        if (is_default) {
            await db.query(`UPDATE label_config SET is_default = FALSE WHERE id != ?`, [id]);
        }

        await db.query(`
            UPDATE label_config SET
                name           = ?,
                is_default     = ?,
                printer_mode   = ?,
                printer_host   = ?,
                printer_port   = ?,
                print_offset_x = ?,
                print_offset_y = ?,
                label_fields   = ?,
                updated_at     = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name || 'Modelo Padrão',
            is_default ? 1 : 0,
            printer_mode || 'tcp',
            printer_host || '127.0.0.1',
            parseInt(printer_port) || DEFAULT_PORT,
            parseInt(print_offset_x) || 0,
            parseInt(print_offset_y) || 0,
            JSON.stringify(label_fields || []),
            id
        ]);

        res.json({ ok: true });
    } catch (err) {
        console.error('[Labels] PUT /config:', err);
        res.status(500).json({ error: 'Erro ao salvar configuração' });
    }
});

// ── POST /api/labels/config/new ────────────────────────────────────────────────
router.post('/config/new', async (req, res) => {
    try {
        const { name, printer_mode, printer_host, printer_port, print_offset_x, print_offset_y, label_fields } = req.body;

        const [result] = await db.query(`
            INSERT INTO label_config 
                (name, is_default, printer_mode, printer_host, printer_port, print_offset_x, print_offset_y, label_fields) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name || 'Novo Modelo',
            0,
            printer_mode || 'tcp',
            printer_host || '127.0.0.1',
            parseInt(printer_port) || DEFAULT_PORT,
            parseInt(print_offset_x) || 0,
            parseInt(print_offset_y) || 0,
            JSON.stringify(label_fields || [])
        ]);

        res.json({ ok: true, insertId: result.insertId });
    } catch (err) {
        console.error('[Labels] POST /config/new:', err);
        res.status(500).json({ error: 'Erro ao criar modelo de etiqueta' });
    }
});

// ── DELETE /api/labels/config/:id ──────────────────────────────────────────────
router.delete('/config/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT COUNT(*) as count FROM label_config');
        if (rows[0].count <= 1) {
            return res.status(400).json({ error: 'Não é possível excluir o único modelo de etiqueta existente.' });
        }
        await db.query('DELETE FROM label_config WHERE id = ?', [req.params.id]);
        
        await db.query(`UPDATE label_config SET is_default = 1 ORDER BY id LIMIT 1`);
        
        res.json({ ok: true });
    } catch (err) {
        console.error('[Labels] DELETE /config/:id:', err);
        res.status(500).json({ error: 'Erro ao excluir modelo de etiqueta' });
    }
});

// ── POST /api/labels/logo ─────────────────────────────────────────────────────
router.post('/logo', upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });

        const id = req.body.id;
        if (!id) return res.status(400).json({ error: 'ID do modelo é obrigatório' });

        const result = await processImageToGW(req.file.buffer, 10, 10);

        // Salva no banco: base64 da imagem original + dados do bitmap processado
        await db.query(`
            UPDATE label_config SET
                logo_base64    = ?,
                logo_width     = ?,
                logo_height    = ?,
                logo_bytes_row = ?,
                logo_bitmap    = ?,
                updated_at     = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            req.file.buffer.toString('base64'),
            result.widthDots,
            result.heightDots,
            result.bytesPerRow,
            Buffer.from(result.bitmapBytes).toString('base64'),
            id
        ]);

        res.json({
            ok: true,
            widthDots:    result.widthDots,
            heightDots:   result.heightDots,
            previewBase64: result.base64Preview,
        });
    } catch (err) {
        console.error('[Labels] POST /logo:', err);
        res.status(500).json({ error: 'Erro ao processar logo: ' + err.message });
    }
});

// ── POST /api/labels/test-connection ─────────────────────────────────────────
router.post('/test-connection', async (req, res) => {
    try {
        const { host, port } = req.body;
        if (!host) return res.status(400).json({ error: 'Host é obrigatório' });

        const result = await testConnection(host, parseInt(port) || DEFAULT_PORT);
        res.json(result);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── POST /api/labels/preview ──────────────────────────────────────────────────
// Retorna dados para o frontend renderizar o preview visual da etiqueta
router.post('/preview', async (req, res) => {
    try {
        const { item, templateId } = req.body; // Um item de exemplo

        let query = 'SELECT label_fields, logo_base64, logo_width, logo_height FROM label_config ORDER BY is_default DESC, id LIMIT 1';
        let params = [];
        if (templateId) {
            query = 'SELECT label_fields, logo_base64, logo_width, logo_height FROM label_config WHERE id = ? LIMIT 1';
            params = [templateId];
        }

        const [rows] = await db.query(query, params);
        const config = rows[0] || {};

        let parsedFields = [];
        if (typeof config.label_fields === 'string') {
            try { parsedFields = JSON.parse(config.label_fields); } catch(e){}
        } else {
            parsedFields = config.label_fields || [];
        }

        const fields = buildFields(item || {}, parsedFields);

        res.json({
            ok: true,
            fields,
            logoBase64: config.logo_base64 ? `data:image/png;base64,${config.logo_base64}` : null,
            logoWidth: config.logo_width,
            logoHeight: config.logo_height,
        });
    } catch (err) {
        console.error('[Labels] POST /preview:', err);
        res.status(500).json({ error: 'Erro ao gerar preview' });
    }
});

// ── POST /api/labels/print ────────────────────────────────────────────────────
router.post('/print', async (req, res) => {
    try {
        const { items, copiesMode = 'one', customCopies = 1, templateId } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item para imprimir' });
        }

        let query = 'SELECT * FROM label_config ORDER BY is_default DESC, id LIMIT 1';
        let params = [];
        if (templateId) {
            query = 'SELECT * FROM label_config WHERE id = ? LIMIT 1';
            params = [templateId];
        }

        // Busca configuração
        const [rows] = await db.query(query, params);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Configuração de etiqueta não encontrada. Configure em Configurações > Etiquetas.' });
        }
        const config = rows[0];

        // Monta logo (se existir)
        let logoData = null;
        if (config.logo_bitmap) {
            const bitmapBuffer = Buffer.from(config.logo_bitmap, 'base64');
            logoData = {
                header: `GW10,10,${config.logo_bytes_row},${config.logo_height}\n`,
                bitmapBuffer,
                heightDots: config.logo_height,
                widthDots:  config.logo_width,
            };
        }

        const host = config.printer_mode === 'usb' ? '127.0.0.1' : config.printer_host;
        const port = parseInt(config.printer_port) || DEFAULT_PORT;

        const results = [];

        for (const item of items) {
            try {
                const copies = calculateCopies(copiesMode, item, customCopies);
                let parsedFields = [];
                if (typeof config.label_fields === 'string') {
                    try { parsedFields = JSON.parse(config.label_fields); } catch(e){}
                } else {
                    parsedFields = config.label_fields || [];
                }
                const fields = buildFields(item, parsedFields);
                const labelBuffer = buildLabel({ logo: logoData, fields }, copies);

                await sendRaw(host, port, labelBuffer);
                results.push({ item: item.produto || item.item, ok: true, copies });
            } catch (err) {
                results.push({ item: item.produto || item.item, ok: false, error: err.message });
            }
        }

        const allOk = results.every(r => r.ok);
        res.json({ ok: allOk, results });
    } catch (err) {
        console.error('[Labels] POST /print:', err);
        res.status(500).json({ error: 'Erro interno ao imprimir: ' + err.message });
    }
});

// ── POST /api/labels/print-canvas (NOVA ARQUITETURA WYSIWYG) ────────────────────
router.post('/print-canvas', async (req, res) => {
    try {
        const { items, quality = 5, autoRewind = true } = req.body;
        // items: [{ itemId, copies, canvasBase64, itemData }]

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item para imprimir' });
        }

        // Calcula o threshold baseado na qualidade (1 a 10)
        // 5 = 128 (Normal). 10 = ~210 (Muito grosso/escuro). 1 = ~60 (Muito fino/claro)
        const q = Math.max(1, Math.min(10, parseInt(quality) || 5));
        const thresholdValue = Math.round(50 + ((q - 1) * (160 / 9))); // Mapeia 1-10 para 50-210

        let query = 'SELECT printer_mode, printer_host, printer_port, print_offset_x, print_offset_y FROM label_config ORDER BY is_default DESC, id LIMIT 1';
        let params = [];
        if (req.body.templateId) {
            query = 'SELECT printer_mode, printer_host, printer_port, print_offset_x, print_offset_y FROM label_config WHERE id = ? LIMIT 1';
            params = [req.body.templateId];
        }

        // Busca configuração (somente para IP/Porta)
        const [rows] = await db.query(query, params);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Configuração de etiqueta não encontrada.' });
        }
        const config = rows[0];
        
        const host = config.printer_mode === 'usb' ? '127.0.0.1' : config.printer_host;
        const port = parseInt(config.printer_port) || DEFAULT_PORT;

        const results = [];
        
        for (const item of items) {
            try {
                if (!item.canvasBase64) {
                    throw new Error('Imagem Canvas não fornecida para o item');
                }

                // Converte base64 → PNG → escala de cinza com threshold (BW puro)
                // BW puro elimina dithering do driver e melhora qualidade de impressão
                const rawPng = Buffer.from(
                    item.canvasBase64.replace(/^data:image\/\w+;base64,/, ''),
                    'base64'
                );
                const pngBuffer = await sharp(rawPng)
                    .greyscale()
                    .threshold(thresholdValue)
                    .png()
                    .toBuffer();

                // Header Lynx (8 bytes) com offset de impressão
                const offsetX = parseInt(config.print_offset_x) || 0;
                const offsetY = parseInt(config.print_offset_y) || 0;
                const header = Buffer.alloc(8);
                header[0] = 0x4D; header[1] = 0x46; // "MF" magic
                header.writeInt16BE(offsetX, 2);
                header.writeInt16BE(offsetY, 4);
                
                // Futuramente podemos enviar a flag autoRewind no byte 6 se necessário
                header[6] = autoRewind ? 1 : 0;
                const packet = Buffer.concat([header, pngBuffer]);

                const copies = item.copies || 1;
                for (let c = 0; c < copies; c++) {
                    await sendRaw(host, port, packet);
                    // Delay para evitar colisão de Date.now() no print-bridge e 
                    // não sobrecarregar o Windows com processos do PowerShell simultâneos
                    if (copies > 1 || items.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }

                results.push({ item: item.itemId, ok: true, copies });
            } catch (err) {
                console.error(`Erro ao imprimir item ${item.itemId}:`, err);
                results.push({ item: item.itemId, ok: false, error: err.message });
            }
        }

        const allOk = results.every(r => r.ok);
        res.json({ ok: allOk, results });
    } catch (err) {
        console.error('[Labels] POST /print-canvas:', err);
        res.status(500).json({ error: 'Erro interno ao imprimir: ' + err.message });
    }
});

// ── GET /api/labels/download-agent ───────────────────────────────────────────
// Serve o print-agent.exe para download pelo usuário
router.get('/download-agent', (_req, res) => {
    const agentPath = path.resolve(__dirname, '../../client/public/Lynx-Print-Agent.ems');
    if (!fs.existsSync(agentPath)) {
        return res.status(404).json({ error: 'Lynx-Print-Agent.ems não encontrado no servidor.' });
    }
    res.download(agentPath, 'Lynx-Print-Agent.ems');
});

module.exports = router;
