const express = require('express');
const router = express.Router();
const multer = require('multer');
const mysqlService = require('../services/mysqlService');
const db = require('../db');

// Use memory storage for the file upload
const upload = multer({ storage: multer.memoryStorage() });

// --- SETUP ENDPOINT ---
router.post('/setup', async (req, res) => {
    try {
        // Access mysqlPool from req.app or import it directly if your architecture allows
        // Here we assume mysqlPool is attached to req.app in server.js or we require it
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        
        if (!pool) {
            return res.status(500).json({ error: 'MySQL Pool not found.' });
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_wabtec_imports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                file_name VARCHAR(255) NOT NULL,
                sheet_name VARCHAR(255) NOT NULL,
                imported_by VARCHAR(100),
                total_rows INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_wabtec_imported_rows (
                id INT AUTO_INCREMENT PRIMARY KEY,
                import_id INT NOT NULL,
                po_number VARCHAR(100),
                pedido_metal VARCHAR(50),
                cod_produto VARCHAR(100),
                saldo DECIMAL(10,2),
                item_cliente VARCHAR(100),
                data_pcp_cliente DATE,
                raw_data LONGTEXT,
                FOREIGN KEY (import_id) REFERENCES app_wabtec_imports(id) ON DELETE CASCADE
            )
        `);

        res.json({ message: 'Webtech tables created successfully.' });
    } catch (err) {
        console.error('Error creating webtech tables:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- IMPORT EXCEL DATA ---
router.post('/import', upload.single('file'), async (req, res) => {
    // This will handle the parsed excel data (we will parse on frontend or backend, frontend is easier and matches VMI)
    try {
        const { fileName, sheetName, rows, importedBy } = req.body;
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');

        if (!rows || !Array.isArray(rows)) {
            return res.status(400).json({ error: 'Nenhuma linha enviada para importação.' });
        }

        // Create import record
        const [importResult] = await pool.query(
            'INSERT INTO app_wabtec_imports (file_name, sheet_name, imported_by, total_rows) VALUES (?, ?, ?, ?)',
            [fileName || 'Arquivo Desconhecido', sheetName || 'Aba Desconhecida', importedBy || 'Sistema', rows.length]
        );
        const importId = importResult.insertId;

        // Insert rows
        const values = [];
        for (const row of rows) {
            values.push([
                importId,
                row.po_number || null,
                row.pedido_metal || null,
                row.cod_produto || null,
                row.saldo ? parseFloat(row.saldo) : null,
                row.item_cliente || null,
                row.data_pcp_cliente || null, // Expecting YYYY-MM-DD
                JSON.stringify(row.raw_data || {})
            ]);
        }

        if (values.length > 0) {
            await pool.query(
                `INSERT INTO app_wabtec_imported_rows 
                (import_id, po_number, pedido_metal, cod_produto, saldo, item_cliente, data_pcp_cliente, raw_data) 
                VALUES ?`,
                [values]
            );
        }

        res.json({ success: true, importId, message: `${rows.length} linhas importadas com sucesso.` });
    } catch (err) {
        console.error('Error importing webtech data:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- GET COMPARISON DATA ---
router.get('/comparison', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService'); 
        const pgClient = req.app.locals.db || require('../services/db'); // Postgres connection
        
        // 1. Fetch the latest import rows
        const [imports] = await pool.query('SELECT id FROM app_wabtec_imports ORDER BY id DESC LIMIT 1');
        if (imports.length === 0) {
            return res.json({ rows: [] });
        }
        const lastImportId = imports[0].id;
        
        const [importedRows] = await pool.query('SELECT * FROM app_wabtec_imported_rows WHERE import_id = ?', [lastImportId]);
        
        // 2. Fetch corresponding data from SINCO (Protheus + PCP)
        // We will match using "pedido_metal" and "cod_produto"
        
        // Return for now just the imported rows so we can test the upload flow
        res.json({ rows: importedRows });

    } catch (err) {
        console.error('Error getting webtech comparison:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- GET LOTES ---
router.get('/lotes', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        const [rows] = await pool.query('SELECT id, file_name, sheet_name, imported_by, total_rows, created_at FROM app_wabtec_imports ORDER BY created_at DESC');
        res.json({ data: rows });
    } catch (err) {
        console.error('Error fetching wabtec lotes:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- DELETE LOTE ---
router.delete('/lotes/:id', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        await pool.query('DELETE FROM app_wabtec_imports WHERE id = ?', [req.params.id]);
        res.json({ msg: 'Lote removido com sucesso.' });
    } catch (err) {
        console.error('Error deleting wabtec lote:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- GET DEMANDAS (by lote) ---
router.get('/demandas', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService'); 
        const loteId = req.query.lote;
        
        let query = 'SELECT * FROM app_wabtec_imported_rows';
        let params = [];
        
        if (loteId) {
            query += ' WHERE import_id = ?';
            params.push(loteId);
        } else {
            // Default to latest if no lote specified
            const [imports] = await pool.query('SELECT id FROM app_wabtec_imports ORDER BY id DESC LIMIT 1');
            if (imports.length === 0) {
                return res.json({ data: [] });
            }
            query += ' WHERE import_id = ?';
            params.push(imports[0].id);
        }
        
        const [importedRows] = await pool.query(query, params);
        
        // --- Cross-reference with Protheus (sc6010) and SINCO (app_pcp_delivery_forecasts) ---
        if (importedRows.length > 0) {
            const pedidosSet = new Set();
            importedRows.forEach(r => {
                if (r.pedido_metal) pedidosSet.add(String(r.pedido_metal).padStart(6, '0'));
            });
            const pedidos = Array.from(pedidosSet);
            
            if (pedidos.length > 0) {
                const pgClient = await db.connect();
                let protheusItems = [];
                try {
                    const placeholders = pedidos.map((_, i) => `$${i + 1}`).join(',');
                    const pgQuery = `
                        SELECT TRIM(c6_num) as c6_num, TRIM(c6_item) as c6_item, TRIM(c6_pedcli) as c6_pedcli, TRIM(c6_produto) as c6_produto 
                        FROM public.sc6010 
                        WHERE c6_num IN (${placeholders})
                    `;
                    const pgRes = await pgClient.query(pgQuery, pedidos);
                    protheusItems = pgRes.rows;
                } finally {
                    pgClient.release();
                }

                const mysqlPlaceholders = pedidos.map(() => '?').join(',');
                const pcpQuery = `
                    SELECT pedido, item, MAX(data_entrega_pcp) as data_entrega_pcp 
                    FROM app_pcp_delivery_forecasts 
                    WHERE pedido IN (${mysqlPlaceholders})
                    GROUP BY pedido, item
                `;
                const [pcpRows] = await pool.query(pcpQuery, pedidos);
                
                const pcpDatesMap = {};
                pcpRows.forEach(row => {
                    const key = `${row.pedido.trim()}_${row.item.trim()}`;
                    if (!pcpDatesMap[key]) pcpDatesMap[key] = row.data_entrega_pcp;
                });

                importedRows.forEach(row => {
                    if (!row.pedido_metal || !row.po_number) {
                        row.data_sinco = null;
                        row.sinco_item = null;
                        return;
                    }
                    const formattedPedido = String(row.pedido_metal).padStart(6, '0');
                    const poNumber = String(row.po_number).trim();
                    const codProduto = String(row.cod_produto).trim();
                    
                    // Relax the match: use only pedido and produto, ignore PO Number as it often mismatches
                    const matchedItem = protheusItems.find(p => p.c6_num === formattedPedido && p.c6_produto === codProduto);
                    
                    if (matchedItem) {
                        row.sinco_item = matchedItem.c6_item;
                        const key = `${formattedPedido}_${matchedItem.c6_item}`;
                        row.data_sinco = pcpDatesMap[key] || null;
                    } else {
                        row.sinco_item = null;
                        row.data_sinco = null;
                    }
                });
            }
        }

        res.json({ data: importedRows });
    } catch (err) {
        console.error('Error getting wabtec demandas:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- UPDATE SINCO DATE ---
router.post('/update-sinco-date', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        const { pedido_metal, item, nova_data, usuario } = req.body;
        
        if (!pedido_metal || !item || !nova_data) {
            return res.status(400).json({ error: 'Pedido Metalfisa, Item e Data são obrigatórios.' });
        }
        
        const formattedPedido = String(pedido_metal).padStart(6, '0');
        const formattedItem = String(item).padStart(2, '0');

        // Sanitize date: strip time/timezone, keep only YYYY-MM-DD
        const sanitizedDate = nova_data
            ? String(nova_data).split('T')[0].split(' ')[0]
            : null;

        if (!sanitizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(sanitizedDate)) {
            return res.status(400).json({ error: `Data inválida: "${nova_data}". Formato esperado: YYYY-MM-DD.` });
        }
        
        const [existing] = await pool.query('SELECT * FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY id DESC LIMIT 1', [formattedPedido, formattedItem]);
        const uName = usuario || 'WabTec Sync';
        
        if (existing.length > 0) {
            // Update ALL existing records for this pedido+item to ensure Visão Geral (which maps by OP sequence) reflects it.
            await pool.query(
                'UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, usuario = ?, observacao = ? WHERE pedido = ? AND item = ?',
                [sanitizedDate, uName, 'Atualizado via WabTec Import', formattedPedido, formattedItem]
            );
            res.json({ success: true, msg: 'Data atualizada no SINCO com sucesso!' });
        } else {
            // Insert a new record if none exists
            await pool.query(
                'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus, data_prevista_faturamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [formattedPedido, formattedItem, sanitizedDate, '0', uName, 'Atualizado via WabTec Import', null, null]
            );
            res.json({ success: true, msg: 'Data inserida no SINCO com sucesso!' });
        }
    } catch (err) {
        console.error('Error updating SINCO date:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- UPDATE SINCO DATE BULK ---
router.post('/update-sinco-date-bulk', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        const { updates, usuario } = req.body;
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'Nenhuma atualização fornecida.' });
        }
        
        const uName = usuario || 'WabTec Sync';
        let successCount = 0;
        let errorCount = 0;

        for (const update of updates) {
            try {
                const { pedido_metal, item, nova_data } = update;
                if (!pedido_metal || !item || !nova_data) continue;
                
                const formattedPedido = String(pedido_metal).padStart(6, '0');
                const formattedItem = String(item).padStart(2, '0');
                const sanitizedDate = nova_data ? String(nova_data).split('T')[0].split(' ')[0] : null;

                if (!sanitizedDate || !/^\\d{4}-\\d{2}-\\d{2}$/.test(sanitizedDate)) continue;

                const [existing] = await pool.query('SELECT id FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY id DESC LIMIT 1', [formattedPedido, formattedItem]);
                
                if (existing.length > 0) {
                    await pool.query(
                        'UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, usuario = ?, observacao = ? WHERE pedido = ? AND item = ?',
                        [sanitizedDate, uName, 'Atualizado via WabTec Import', formattedPedido, formattedItem]
                    );
                } else {
                    await pool.query(
                        'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus, data_prevista_faturamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [formattedPedido, formattedItem, sanitizedDate, '0', uName, 'Atualizado via WabTec Import', null, null]
                    );
                }
                successCount++;
            } catch (innerErr) {
                console.error('Lote update error on item:', update, innerErr);
                errorCount++;
            }
        }
        
        res.json({ success: true, successCount, errorCount, msg: `Lote processado. Sucesso: ${successCount}. Erros: ${errorCount}.` });
    } catch (err) {
        console.error('Error updating SINCO dates in bulk:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- FETCH SINGLE SINCO DATE ---
router.get('/sinco-date', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        const { pedido_metal, po_number, cod_produto } = req.query;
        
        if (!pedido_metal || !po_number || !cod_produto) {
            return res.status(400).json({ error: 'Pedido, PO Number e Cód. Produto são obrigatórios.' });
        }
        
        const formattedPedido = String(pedido_metal).padStart(6, '0');
        const formattedPoNumber = String(po_number).trim();
        const formattedCodProduto = String(cod_produto).trim();
        
        const pgClient = await db.connect();
        let item = null;
        try {
            const pgQuery = `
                SELECT TRIM(c6_item) as c6_item 
                FROM public.sc6010 
                WHERE TRIM(c6_num) = $1 AND TRIM(c6_pedcli) = $2 AND TRIM(c6_produto) = $3
                LIMIT 1
            `;
            const pgRes = await pgClient.query(pgQuery, [formattedPedido, formattedPoNumber, formattedCodProduto]);
            if (pgRes.rows.length > 0) {
                item = pgRes.rows[0].c6_item;
            }
        } finally {
            pgClient.release();
        }
        
        if (!item) {
            return res.json({ data_sinco: null, item: null, msg: 'Item não encontrado no Protheus para este Pedido, PO Number e Produto.' });
        }
        
        const [existing] = await pool.query('SELECT MAX(data_entrega_pcp) as data_entrega_pcp FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ?', [formattedPedido, item]);
        
        if (existing.length > 0) {
            res.json({ data_sinco: existing[0].data_entrega_pcp, item: item });
        } else {
            res.json({ data_sinco: null, item: item, msg: 'Data não encontrada no SINCO.' });
        }
    } catch (err) {
        console.error('Error fetching SINCO date:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
