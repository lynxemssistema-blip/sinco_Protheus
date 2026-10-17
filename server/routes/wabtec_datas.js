const express = require('express');
const router = express.Router();
const multer = require('multer');
const mysqlService = require('../services/mysqlService');
const protheusDB = require('../services/protheusDB');
const { invalidateForecastCache } = require('../services/forecastCache');

const cleanCode = (s) => (s || '').toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();

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
            const raw = row.raw_data || {};
            const ped = row.pedido_metal || raw['PEDIDO'] || raw['Pedido'] || raw['Pedido Metal'] || null;
            const cod = row.cod_produto || raw['COD'] || raw['Cod'] || raw['Cód. Produto'] || raw['Produto'] || null;
            const itemCli = row.item_cliente || raw['Número de item'] || raw['Item Cliente'] || null;
            const sld = row.saldo !== undefined && row.saldo !== null ? parseFloat(row.saldo) : (raw['SALDO'] !== undefined ? parseFloat(raw['SALDO']) : 0);
            const dt = row.data_pcp_cliente || raw['SINCO'] || raw['Necessario por Data'] || null;

            values.push([
                importId,
                row.po_number || raw['Número PO'] || null,
                ped,
                cod,
                sld,
                itemCli,
                dt,
                JSON.stringify(raw)
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
        
        // Normalize / Recover fields from raw_data if any were missing in past imports
        importedRows.forEach(r => {
            let raw = {};
            if (typeof r.raw_data === 'string') {
                try { raw = JSON.parse(r.raw_data); } catch(e) {}
            } else if (r.raw_data && typeof r.raw_data === 'object') {
                raw = r.raw_data;
            }

            if (!r.pedido_metal) {
                r.pedido_metal = raw['PEDIDO'] || raw['Pedido'] || raw['Pedido Metal'] || raw['Num. Pedido'] || null;
            }
            if (!r.cod_produto) {
                r.cod_produto = raw['COD'] || raw['Cod'] || raw['Cód. Produto'] || raw['Código Lynx'] || raw['Produto'] || null;
            }
            if (!r.item_cliente) {
                r.item_cliente = raw['Número de item'] || raw['Item Cliente'] || raw['Part Number'] || null;
            }
            if (!r.data_pcp_cliente) {
                r.data_pcp_cliente = raw['SINCO'] || raw['Necessario por Data'] || raw['Date promise'] || null;
            }
            if ((r.saldo === null || r.saldo === undefined || r.saldo === 0) && raw['SALDO'] !== undefined) {
                r.saldo = Number(raw['SALDO']) || 0;
            }
        });
        
        // --- Cross-reference with Protheus (sc6010) and SINCO (app_pcp_delivery_forecasts) ---
        if (importedRows.length > 0) {
            const poSet = new Set();
            const pedidosSet = new Set();
            importedRows.forEach(r => {
                if (r.po_number) {
                    const cleanPo = cleanCode(r.po_number);
                    if (cleanPo) poSet.add(cleanPo);
                }
                if (r.pedido_metal) {
                    const cleanPed = cleanCode(r.pedido_metal).padStart(6, '0');
                    if (cleanPed) pedidosSet.add(cleanPed);
                }
            });
            const pos = Array.from(poSet);
            const pedidos = Array.from(pedidosSet);

            let protheusItems = [];
            if (pos.length > 0 || pedidos.length > 0) {
                try {
                    let pgQuery = `
                        SELECT TRIM(c6_num) as c6_num, TRIM(c6_item) as c6_item, TRIM(c6_pedcli) as c6_pedcli, TRIM(c6_produto) as c6_produto, TRIM(c6_xproc1) as c6_xproc1 
                        FROM public.sc6010 
                        WHERE COALESCE(d_e_l_e_t_, '') NOT IN ('*', '  *')
                    `;
                    const conditions = [];
                    const params = [];
                    if (pos.length > 0) {
                        const poPlaceholders = pos.map((_, i) => `$${params.length + i + 1}`).join(',');
                        params.push(...pos);
                        conditions.push(`TRIM(c6_pedcli) IN (${poPlaceholders})`);
                    }
                    if (pedidos.length > 0) {
                        const pedPlaceholders = pedidos.map((_, i) => `$${params.length + i + 1}`).join(',');
                        params.push(...pedidos);
                        conditions.push(`TRIM(c6_num) IN (${pedPlaceholders})`);
                    }
                    pgQuery += ` AND (${conditions.join(' OR ')})`;

                    const pgRes = await protheusDB.query(pgQuery, params);
                    protheusItems = pgRes.rows || [];
                } catch (pgErr) {
                    console.error('Erro ao consultar Protheus em /demandas:', pgErr.message);
                }
            }

            // Get PCP forecast dates from MySQL
            const allMatchedPedidos = Array.from(new Set([
                ...pedidos,
                ...protheusItems.map(p => cleanCode(p.c6_num).padStart(6, '0'))
            ])).filter(Boolean);

            const pcpDatesMap = {};
            if (allMatchedPedidos.length > 0) {
                const mysqlPlaceholders = allMatchedPedidos.map(() => '?').join(',');
                const pcpQuery = `
                    SELECT pedido, item, MAX(data_entrega_pcp) as data_entrega_pcp 
                    FROM app_pcp_delivery_forecasts 
                    WHERE pedido IN (${mysqlPlaceholders})
                    GROUP BY pedido, item
                `;
                const [pcpRows] = await pool.query(pcpQuery, allMatchedPedidos);
                pcpRows.forEach(row => {
                    const key = `${cleanCode(row.pedido)}_${cleanCode(row.item)}`;
                    if (!pcpDatesMap[key]) pcpDatesMap[key] = row.data_entrega_pcp;
                });
            }

            importedRows.forEach(row => {
                const cleanPo = cleanCode(row.po_number);
                const cleanRef = cleanCode(row.item_cliente);
                const cleanProd = cleanCode(row.cod_produto);
                const cleanPed = row.pedido_metal ? cleanCode(row.pedido_metal).padStart(6, '0') : '';
                
                // Priority 1: Match PO NUMBER (c6_pedcli) + REF. CLIENTE (c6_xproc1)
                let matchedItem = null;
                if (cleanPo && cleanRef) {
                    matchedItem = protheusItems.find(p => 
                        cleanCode(p.c6_pedcli) === cleanPo && 
                        (cleanCode(p.c6_xproc1) === cleanRef || cleanCode(p.c6_produto) === cleanProd)
                    );
                }

                // Priority 2: Match PO NUMBER (c6_pedcli) + PRODUTO (c6_produto)
                if (!matchedItem && cleanPo && cleanProd) {
                    matchedItem = protheusItems.find(p => 
                        cleanCode(p.c6_pedcli) === cleanPo && 
                        cleanCode(p.c6_produto) === cleanProd
                    );
                }

                // Priority 3: Match PO NUMBER (c6_pedcli) directly
                if (!matchedItem && cleanPo) {
                    matchedItem = protheusItems.find(p => 
                        cleanCode(p.c6_pedcli) === cleanPo
                    );
                }

                // Priority 4: Fallback to REF. CLIENTE + PRODUTO (if PO is empty)
                if (!matchedItem && cleanRef && cleanPed) {
                    matchedItem = protheusItems.find(p => 
                        cleanCode(p.c6_num) === cleanPed && 
                        (cleanCode(p.c6_xproc1) === cleanRef || cleanCode(p.c6_produto) === cleanProd)
                    );
                }

                // Priority 5: Fallback to PEDIDO + PRODUTO
                if (!matchedItem && cleanPed && cleanProd) {
                    matchedItem = protheusItems.find(p => 
                        cleanCode(p.c6_num) === cleanPed && 
                        cleanCode(p.c6_produto) === cleanProd
                    );
                }
                
                if (matchedItem) {
                    row.sinco_item = matchedItem.c6_item;
                    if (!row.pedido_metal) {
                        row.pedido_metal = matchedItem.c6_num;
                    }
                    const pedKey = cleanCode(row.pedido_metal || matchedItem.c6_num).padStart(6, '0');
                    const key = `${pedKey}_${cleanCode(matchedItem.c6_item)}`;
                    row.data_sinco = pcpDatesMap[key] || null;
                } else {
                    row.sinco_item = null;
                    row.data_sinco = null;
                }
            });
        }

        res.json({ data: importedRows });
    } catch (err) {
        console.error('Error getting wabtec demandas:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- UPDATE SINCO DATE ---
// --- HELPER TO DEDUPLICATE AND CLEANUP ALL FORECASTS ---
async function runPcpForecastDeduplication(pool) {
    try {
        // 1. Delete duplicate rows with the exact same (pedido, item, op_protheus) keeping the highest ID
        await pool.query(`
            DELETE f1 FROM app_pcp_delivery_forecasts f1
            JOIN app_pcp_delivery_forecasts f2 
              ON f1.pedido = f2.pedido 
             AND f1.item = f2.item 
             AND COALESCE(TRIM(f1.op_protheus), '') = COALESCE(TRIM(f2.op_protheus), '')
             AND f1.id < f2.id
        `);

        // 2. Delete generic records (op_protheus IS NULL/empty) when an OP record exists for that same (pedido, item)
        await pool.query(`
            DELETE f_generic FROM app_pcp_delivery_forecasts f_generic
            JOIN app_pcp_delivery_forecasts f_op
              ON f_generic.pedido = f_op.pedido
             AND f_generic.item = f_op.item
             AND (f_generic.op_protheus IS NULL OR f_generic.op_protheus = '' OR f_generic.op_protheus = '-')
             AND (f_op.op_protheus IS NOT NULL AND f_op.op_protheus != '' AND f_op.op_protheus != '-')
        `);

        invalidateForecastCache();
        console.log('✅ Deduplicação de previsões PCP concluída com sucesso.');
    } catch (err) {
        console.error('Erro na deduplicação de previsões PCP:', err.message);
    }
}

// --- HELPER TO SYNC PCP DELIVERY FORECAST (BY OP OR BY ITEM) ---
async function syncPcpDeliveryForecast({ pool, formattedPedido, formattedItem, sanitizedDate, qtdPcp, uName }) {
    // 1. Check if there are OPs in Protheus (SC2010) for this pedido + item
    let opRows = [];
    try {
        const sc2010Res = await protheusDB.query(`
            SELECT TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen) as op_completa,
                   (COALESCE(c2_quant, 0) - COALESCE(c2_quje, 0)) as saldo_op
            FROM public.sc2010
            WHERE TRIM(c2_pedido) = $1 AND TRIM(c2_itempv) = $2
              AND COALESCE(d_e_l_e_t_, '') NOT IN ('*', '  *')
        `, [formattedPedido, formattedItem]);
        opRows = sc2010Res.rows || [];
    } catch (e) {
        console.error('Erro ao consultar SC2010 para OPs:', e.message);
    }

    if (opRows.length > 0) {
        // CASE 1: Item has OP(s).
        // 1.1 First, DELETE any old generic records without OP for this pedido+item (so we don't have duplicate unlinked rows)
        await pool.query(
            'DELETE FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? AND (op_protheus IS NULL OR op_protheus = "" OR op_protheus = "-")',
            [formattedPedido, formattedItem]
        );

        // 1.2 For each OP, ensure ONLY ONE record exists with the latest date & qtd
        for (const op of opRows) {
            const opClean = op.op_completa;
            const opSaldo = op.saldo_op > 0 ? String(op.saldo_op) : qtdPcp;

            const [existingOp] = await pool.query(
                'SELECT id, data_entrega_pcp, quantidade_pcp FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? AND TRIM(op_protheus) = ? ORDER BY id DESC',
                [formattedPedido, formattedItem, opClean]
            );

            if (existingOp.length > 0) {
                const keepId = existingOp[0].id;
                if (existingOp.length > 1) {
                    const deleteIds = existingOp.slice(1).map(r => r.id);
                    await pool.query(`DELETE FROM app_pcp_delivery_forecasts WHERE id IN (${deleteIds.map(() => '?').join(',')})`, deleteIds);
                }

                await pool.query(
                    'UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, quantidade_pcp = ?, usuario = ?, observacao = ? WHERE id = ?',
                    [sanitizedDate, opSaldo, uName, 'Atualizado via WabTec Import', keepId]
                );
            } else {
                await pool.query(
                    'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus, data_prevista_faturamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [formattedPedido, formattedItem, sanitizedDate, opSaldo, uName, 'Atualizado via WabTec Import', opClean, null]
                );
            }
        }
    } else {
        // CASE 2: Item does NOT have OP.
        // Reference by Pedido + Item. Ensure ONLY ONE generic record exists.
        const [existing] = await pool.query(
            'SELECT id, data_entrega_pcp, quantidade_pcp FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY id DESC',
            [formattedPedido, formattedItem]
        );

        if (existing.length > 0) {
            const keepId = existing[0].id;
            if (existing.length > 1) {
                const deleteIds = existing.slice(1).map(r => r.id);
                await pool.query(`DELETE FROM app_pcp_delivery_forecasts WHERE id IN (${deleteIds.map(() => '?').join(',')})`, deleteIds);
            }

            await pool.query(
                'UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, quantidade_pcp = ?, usuario = ?, observacao = ?, op_protheus = NULL WHERE id = ?',
                [sanitizedDate, qtdPcp, uName, 'Atualizado via WabTec Import', keepId]
            );
        } else {
            await pool.query(
                'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus, data_prevista_faturamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [formattedPedido, formattedItem, sanitizedDate, qtdPcp, uName, 'Atualizado via WabTec Import', null, null]
            );
        }
    }

    // Invalidate forecast cache to make it immediately visible in Visão Geral
    invalidateForecastCache();
}

// --- UPDATE SINCO DATE ---
router.post('/update-sinco-date', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        const { pedido_metal, item, nova_data, saldo, usuario } = req.body;
        
        if (!pedido_metal || !item || !nova_data) {
            return res.status(400).json({ error: 'Pedido Lynx, Item e Data são obrigatórios.' });
        }
        
        const formattedPedido = String(pedido_metal).padStart(6, '0');
        const formattedItem = String(item).padStart(2, '0');
        const qtdPcp = saldo !== undefined && saldo !== null ? String(saldo) : '0';

        // Sanitize date: strip time/timezone, keep only YYYY-MM-DD
        const sanitizedDate = nova_data
            ? String(nova_data).split('T')[0].split(' ')[0]
            : null;

        if (!sanitizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(sanitizedDate)) {
            return res.status(400).json({ error: `Data inválida: "${nova_data}". Formato esperado: YYYY-MM-DD.` });
        }
        
        const uName = usuario || 'WabTec Sync';
        await syncPcpDeliveryForecast({ pool, formattedPedido, formattedItem, sanitizedDate, qtdPcp, uName });

        res.json({ success: true, msg: 'Data sincronizada no SINCO com sucesso!' });
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

        // ─── FASE 1: Normalizar e validar os updates recebidos ───────────────────
        const validUpdates = [];
        for (const update of updates) {
            const { pedido_metal, item, nova_data, saldo } = update;
            if (!pedido_metal || !item || !nova_data) continue;

            const formattedPedido = String(pedido_metal).padStart(6, '0');
            const formattedItem   = String(item).padStart(2, '0');
            const sanitizedDate   = String(nova_data).split('T')[0].split(' ')[0];
            const qtdPcp          = (saldo !== undefined && saldo !== null) ? String(saldo) : '0';

            if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitizedDate)) continue;

            validUpdates.push({ formattedPedido, formattedItem, sanitizedDate, qtdPcp });
        }

        if (validUpdates.length === 0) {
            return res.json({ success: true, successCount: 0, errorCount: 0, msg: 'Nenhum item válido para atualizar.' });
        }

        // ─── FASE 2: Busca OPs do Protheus EM UMA ÚNICA QUERY via IN() ────────────
        const uniquePedidos = [...new Set(validUpdates.map(u => u.formattedPedido))];
        const opMap = new Map(); // key: "PEDIDO_ITEM" → [{ op_completa, saldo_op }]

        try {
            const placeholders = uniquePedidos.map((_, i) => `$${i + 1}`).join(', ');
            const sc2010Res = await protheusDB.query(`
                SELECT
                    TRIM(c2_pedido) AS pedido,
                    TRIM(c2_itempv) AS item,
                    TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen) AS op_completa,
                    (COALESCE(c2_quant, 0) - COALESCE(c2_quje, 0)) AS saldo_op
                FROM public.sc2010
                WHERE TRIM(c2_pedido) IN (${placeholders})
                  AND COALESCE(d_e_l_e_t_, '') NOT IN ('*', '  *')
            `, uniquePedidos);

            for (const row of sc2010Res.rows || []) {
                const key = `${row.pedido}_${row.item}`;
                if (!opMap.has(key)) opMap.set(key, []);
                opMap.get(key).push({ op_completa: (row.op_completa || '').trim(), saldo_op: row.saldo_op });
            }
        } catch (e) {
            // Protheus pode estar inacessível em dev/local — continuamos sem OPs
            console.warn('[Bulk PCP] Aviso: falha ao consultar SC2010:', e.message);
        }

        // ─── FASE 3: Buscar registros MySQL existentes EM UMA ÚNICA QUERY via IN() ──
        const uniquePairs = [...new Set(validUpdates.map(u => `${u.formattedPedido}|${u.formattedItem}`))];
        const pairConditions = uniquePairs.map(() => '(pedido = ? AND item = ?)').join(' OR ');
        const pairParams = [];
        for (const pair of uniquePairs) {
            const [ped, itm] = pair.split('|');
            pairParams.push(ped, itm);
        }

        let existingRows = [];
        if (uniquePairs.length > 0) {
            [existingRows] = await pool.query(
                `SELECT id, pedido, item, op_protheus FROM app_pcp_delivery_forecasts WHERE ${pairConditions} ORDER BY id ASC`,
                pairParams
            );
        }

        // Organiza por key "PEDIDO_ITEM_OP" → [ids]
        const existingByKey = new Map();
        for (const row of existingRows) {
            const op  = (row.op_protheus || '').trim();
            const key = `${row.pedido}_${row.item}_${op}`;
            if (!existingByKey.has(key)) existingByKey.set(key, []);
            existingByKey.get(key).push(row.id);
        }

        // ─── FASE 4: Decisão em memória ──────────────────────────────────────────
        const toUpsert = []; // { pedido, item, op, data, qtd, keepId }
        const toDelete = []; // IDs a deletar

        for (const upd of validUpdates) {
            const { formattedPedido, formattedItem, sanitizedDate, qtdPcp } = upd;
            const itemKey = `${formattedPedido}_${formattedItem}`;
            const opRows  = opMap.get(itemKey) || [];

            if (opRows.length > 0) {
                // Item TEM OPs → programar por OP, remover registros genéricos
                const genericIds = existingByKey.get(`${formattedPedido}_${formattedItem}_`) || [];
                toDelete.push(...genericIds);

                for (const op of opRows) {
                    const opClean = (op.op_completa || '').trim();
                    const opSaldo = op.saldo_op > 0 ? String(op.saldo_op) : qtdPcp;
                    const ids     = existingByKey.get(`${formattedPedido}_${formattedItem}_${opClean}`) || [];

                    if (ids.length > 1) {
                        const sorted = [...ids].sort((a, b) => b - a);
                        toDelete.push(...sorted.slice(1));
                        toUpsert.push({ pedido: formattedPedido, item: formattedItem, op: opClean, data: sanitizedDate, qtd: opSaldo, keepId: sorted[0] });
                    } else if (ids.length === 1) {
                        toUpsert.push({ pedido: formattedPedido, item: formattedItem, op: opClean, data: sanitizedDate, qtd: opSaldo, keepId: ids[0] });
                    } else {
                        toUpsert.push({ pedido: formattedPedido, item: formattedItem, op: opClean, data: sanitizedDate, qtd: opSaldo, keepId: null });
                    }
                }
            } else {
                // Item SEM OP → registro genérico (op_protheus = NULL)
                const ids = existingByKey.get(`${formattedPedido}_${formattedItem}_`) || [];

                if (ids.length > 1) {
                    const sorted = [...ids].sort((a, b) => b - a);
                    toDelete.push(...sorted.slice(1));
                    toUpsert.push({ pedido: formattedPedido, item: formattedItem, op: null, data: sanitizedDate, qtd: qtdPcp, keepId: sorted[0] });
                } else if (ids.length === 1) {
                    toUpsert.push({ pedido: formattedPedido, item: formattedItem, op: null, data: sanitizedDate, qtd: qtdPcp, keepId: ids[0] });
                } else {
                    toUpsert.push({ pedido: formattedPedido, item: formattedItem, op: null, data: sanitizedDate, qtd: qtdPcp, keepId: null });
                }
            }
        }

        // ─── FASE 5: Executar operações em lote ──────────────────────────────────

        // 5a. DELETE em lote (IDs decididos em memória)
        if (toDelete.length > 0) {
            const uniqueDeleteIds = [...new Set(toDelete)];
            const CHUNK = 500;
            for (let i = 0; i < uniqueDeleteIds.length; i += CHUNK) {
                const chunk = uniqueDeleteIds.slice(i, i + CHUNK);
                await pool.query(
                    `DELETE FROM app_pcp_delivery_forecasts WHERE id IN (${chunk.map(() => '?').join(',')})`,
                    chunk
                );
            }
        }

        const toUpdate = toUpsert.filter(u => u.keepId !== null);
        const toInsert = toUpsert.filter(u => u.keepId === null);

        // 5b. UPDATE em lote via CASE WHEN (1 query para todos os updates)
        if (toUpdate.length > 0) {
            try {
                const ids        = toUpdate.map(u => u.keepId);
                const dataCases  = toUpdate.map(u => `WHEN ${u.keepId} THEN ?`).join(' ');
                const qtdCases   = toUpdate.map(u => `WHEN ${u.keepId} THEN ?`).join(' ');
                const dataParams = toUpdate.map(u => u.data);
                const qtdParams  = toUpdate.map(u => u.qtd);
                const idList     = ids.map(() => '?').join(',');

                await pool.query(
                    `UPDATE app_pcp_delivery_forecasts
                     SET data_entrega_pcp = CASE id ${dataCases} END,
                         quantidade_pcp   = CASE id ${qtdCases} END,
                         usuario          = ?,
                         observacao       = ?
                     WHERE id IN (${idList})`,
                    [...dataParams, ...qtdParams, uName, 'Atualizado via WabTec Lote', ...ids]
                );
                successCount += toUpdate.length;
            } catch (e) {
                console.error('[Bulk PCP] Erro no UPDATE em lote:', e.message);
                errorCount += toUpdate.length;
            }
        }

        // 5c. INSERT em lote via multi-VALUES (chunks de 200)
        if (toInsert.length > 0) {
            try {
                const CHUNK = 200;
                for (let i = 0; i < toInsert.length; i += CHUNK) {
                    const chunk  = toInsert.slice(i, i + CHUNK);
                    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
                    const params = [];
                    for (const u of chunk) {
                        params.push(u.pedido, u.item, u.data, u.qtd, uName, 'Atualizado via WabTec Lote', u.op, null);
                    }
                    await pool.query(
                        `INSERT INTO app_pcp_delivery_forecasts
                            (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus, data_prevista_faturamento)
                         VALUES ${values}`,
                        params
                    );
                    successCount += chunk.length;
                }
            } catch (e) {
                console.error('[Bulk PCP] Erro no INSERT em lote:', e.message);
                errorCount += toInsert.length;
            }
        }

        // ─── FASE 6: Deduplicação ESCOPADA (só pedidos do lote, não full-table) ──
        if (uniquePedidos.length > 0) {
            try {
                const pedPh = uniquePedidos.map(() => '?').join(', ');
                await pool.query(`
                    DELETE f1 FROM app_pcp_delivery_forecasts f1
                    JOIN app_pcp_delivery_forecasts f2
                      ON f1.pedido = f2.pedido AND f1.item = f2.item
                     AND COALESCE(TRIM(f1.op_protheus), '') = COALESCE(TRIM(f2.op_protheus), '')
                     AND f1.id < f2.id
                    WHERE f1.pedido IN (${pedPh})
                `, uniquePedidos);

                await pool.query(`
                    DELETE f_generic FROM app_pcp_delivery_forecasts f_generic
                    JOIN app_pcp_delivery_forecasts f_op
                      ON f_generic.pedido = f_op.pedido AND f_generic.item = f_op.item
                     AND (f_generic.op_protheus IS NULL OR f_generic.op_protheus = '' OR f_generic.op_protheus = '-')
                     AND (f_op.op_protheus IS NOT NULL AND f_op.op_protheus != '' AND f_op.op_protheus != '-')
                    WHERE f_generic.pedido IN (${pedPh})
                `, uniquePedidos);
            } catch (e) {
                console.warn('[Bulk PCP] Aviso na deduplicação escopada:', e.message);
            }
        }

        invalidateForecastCache();

        console.log(`✅ [Bulk PCP] Lote finalizado — Updates: ${toUpdate.length} | Inserts: ${toInsert.length} | Deletes: ${toDelete.length} | Erros: ${errorCount}`);
        res.json({
            success: true,
            successCount: successCount || (toUpdate.length + toInsert.length),
            errorCount,
            msg: `Lote processado. Sucesso: ${successCount}. Erros: ${errorCount}.`
        });
    } catch (err) {
        console.error('Error updating SINCO dates in bulk:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- CLEANUP DUPLICATES ENDPOINT ---
router.post('/cleanup-pcp-dupes', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        await runPcpForecastDeduplication(pool);
        res.json({ success: true, msg: 'Limpeza e deduplicação concluídas com sucesso!' });
    } catch (err) {
        console.error('Error cleaning pcp dupes:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- FETCH SINGLE SINCO DATE ---
router.get('/sinco-date', async (req, res) => {
    try {
        const pool = req.app.locals.mysqlPool || require('../services/mysqlService');
        const { pedido_metal, po_number, cod_produto, item_cliente } = req.query;
        
        const cleanPo = cleanCode(po_number);
        const cleanRef = cleanCode(item_cliente);
        const cleanProd = cleanCode(cod_produto);
        const cleanPed = pedido_metal ? cleanCode(pedido_metal).padStart(6, '0') : '';
        
        if (!cleanPo && !cleanPed) {
            return res.status(400).json({ error: 'PO Number ou Pedido Lynx é obrigatório.' });
        }
        
        let matched = null;
        try {
            let pgQuery = `
                SELECT TRIM(c6_num) as c6_num, TRIM(c6_item) as c6_item, TRIM(c6_pedcli) as c6_pedcli, TRIM(c6_produto) as c6_produto, TRIM(c6_xproc1) as c6_xproc1 
                FROM public.sc6010 
                WHERE COALESCE(d_e_l_e_t_, '') NOT IN ('*', '  *')
            `;
            const conditions = [];
            const params = [];
            if (cleanPo) {
                params.push(cleanPo);
                conditions.push(`TRIM(c6_pedcli) = $${params.length}`);
            }
            if (cleanPed) {
                params.push(cleanPed);
                conditions.push(`TRIM(c6_num) = $${params.length}`);
            }
            pgQuery += ` AND (${conditions.join(' OR ')})`;
            
            const pgRes = await protheusDB.query(pgQuery, params);
            
            // Priority 1: Match by PO Number + Ref. Cliente
            if (cleanPo && cleanRef) {
                matched = pgRes.rows.find(p => cleanCode(p.c6_pedcli) === cleanPo && (cleanCode(p.c6_xproc1) === cleanRef || cleanCode(p.c6_produto) === cleanProd));
            }
            // Priority 2: Match by PO Number + Produto
            if (!matched && cleanPo && cleanProd) {
                matched = pgRes.rows.find(p => cleanCode(p.c6_pedcli) === cleanPo && cleanCode(p.c6_produto) === cleanProd);
            }
            // Priority 3: Match by PO Number
            if (!matched && cleanPo) {
                matched = pgRes.rows.find(p => cleanCode(p.c6_pedcli) === cleanPo);
            }
            // Priority 4: Match by Ref. Cliente + Pedido
            if (!matched && cleanRef && cleanPed) {
                matched = pgRes.rows.find(p => cleanCode(p.c6_num) === cleanPed && (cleanCode(p.c6_xproc1) === cleanRef || cleanCode(p.c6_produto) === cleanProd));
            }
            // Priority 5: Match by Pedido + Produto
            if (!matched && cleanPed && cleanProd) {
                matched = pgRes.rows.find(p => cleanCode(p.c6_num) === cleanPed && cleanCode(p.c6_produto) === cleanProd);
            }
        } catch (e) {
            console.error('Erro ao consultar Protheus /sinco-date:', e.message);
        }
        
        if (!matched) {
            return res.json({ data_sinco: null, item: null, msg: 'Item não encontrado no Protheus para esta PO / Ref. Cliente.' });
        }
        
        const finalPed = cleanPed || cleanCode(matched.c6_num).padStart(6, '0');
        const item = matched.c6_item;
        
        const [existing] = await pool.query('SELECT MAX(data_entrega_pcp) as data_entrega_pcp FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ?', [finalPed, item]);
        
        if (existing.length > 0) {
            res.json({ data_sinco: existing[0].data_entrega_pcp, item: item, pedido: finalPed });
        } else {
            res.json({ data_sinco: null, item: item, pedido: finalPed, msg: 'Data não encontrada no SINCO.' });
        }
    } catch (err) {
        console.error('Error fetching SINCO date:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
