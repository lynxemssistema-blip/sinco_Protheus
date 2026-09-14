const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');
const fs = require('fs');
const path = require('path');
const { validate, rules } = require('../middlewares/validate');

// Base path for saving PDFs on the network share
const OS_BASE_PATH = process.platform === 'win32'
    ? '//192.168.1.253/Estrutura Lynx/005-ORDEM DE SERVIÇO'
    : '/mnt/lynx/005-ORDEM DE SERVIÇO';

// Table Initialization — adds codigo_liberacao if table already exists
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_releases (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                codigo_liberacao    VARCHAR(20)  DEFAULT NULL,
                lote_info           VARCHAR(255) NOT NULL,
                data_pcp            VARCHAR(50)  DEFAULT NULL,
                usuario             VARCHAR(100) NOT NULL,
                qtd_ops             INT          DEFAULT 0,
                ops_json            LONGTEXT     DEFAULT NULL,
                caminho_arquivo     VARCHAR(500) DEFAULT NULL,
                status              VARCHAR(50)  DEFAULT 'ABERTO',
                data_liberacao      TIMESTAMP    NULL DEFAULT NULL,
                usuario_liberacao   VARCHAR(100) DEFAULT NULL,
                data_hora           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_lote   (lote_info(64)),
                INDEX idx_data   (data_hora),
                INDEX idx_user   (usuario),
                INDEX idx_status (status),
                INDEX idx_codigo (codigo_liberacao)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Safe migrations: add columns for existing DBs
        await mysqlPool.query(`
            ALTER TABLE app_pcp_releases 
            ADD COLUMN IF NOT EXISTS codigo_liberacao VARCHAR(20) DEFAULT NULL
        `).catch(() => {});

        try {
            await mysqlPool.query(`ALTER TABLE app_pcp_releases ADD COLUMN caminho_arquivo VARCHAR(500) DEFAULT NULL`);
        } catch (e) {}

        try {
            await mysqlPool.query(`ALTER TABLE app_pcp_releases ADD COLUMN status VARCHAR(50) DEFAULT 'ABERTO'`);
        } catch (e) {}

        try {
            await mysqlPool.query(`ALTER TABLE app_pcp_releases ADD COLUMN data_liberacao TIMESTAMP NULL DEFAULT NULL`);
        } catch (e) {}

        try {
            await mysqlPool.query(`ALTER TABLE app_pcp_releases ADD COLUMN usuario_liberacao VARCHAR(100) DEFAULT NULL`);
        } catch (e) {}

        console.log('✅ PCP Releases table initialized');
    } catch (err) {
        console.error('❌ Error initializing app_pcp_releases table:', err);
    }
})();

/**
 * Generate unique liberation code using an atomic sequence table.
 * Prevents duplicate codes under concurrent requests (race condition fix).
/**
 * Generate unique liberation code: LPF-AAAA-NNNNN
 * Strictly sequential auto-increment (e.g. LPF-2026-00001, LPF-2026-00002).
 * Uses GREATEST across releases, forecasts, and item notes with parseInt to avoid JS string concatenation.
 */
const generateCodigoLiberacao = async (conn) => {
    const year = new Date().getFullYear();
    const prefix = `LPF-${year}-`;

    const [[{ maxSeq }]] = await conn.query(
        `SELECT GREATEST(
            COALESCE((
                SELECT MAX(CAST(SUBSTRING(codigo_liberacao, LENGTH(?) + 1) AS UNSIGNED))
                FROM app_pcp_releases
                WHERE codigo_liberacao LIKE ?
            ), 0),
            COALESCE((
                SELECT MAX(CAST(SUBSTRING(lpf_codigo, LENGTH(?) + 1) AS UNSIGNED))
                FROM app_pcp_delivery_forecasts
                WHERE lpf_codigo LIKE ?
            ), 0),
            COALESCE((
                SELECT MAX(CAST(SUBSTRING(lpf_codigo, LENGTH(?) + 1) AS UNSIGNED))
                FROM app_sales_order_item_notes
                WHERE lpf_codigo LIKE ?
            ), 0)
        ) AS maxSeq`,
        [prefix, `${prefix}%`, prefix, `${prefix}%`, prefix, `${prefix}%`]
    );

    const currentMax = parseInt(maxSeq, 10) || 0;
    const nextSeq = currentMax + 1;
    const seq = String(nextSeq).padStart(5, '0');
    return `${prefix}${seq}`;
};


// POST /api/pcp-releases/log — Register a batch liberation
router.post('/log', validate(rules.pcpReleaseLog), async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { lote_info, data_pcp, usuario, qtd_ops, ops_json } = req.body;

        await connection.beginTransaction();

        // Atomic code generation inside the same connection (prevents race condition)
        const codigo_liberacao = await generateCodigoLiberacao(connection);

        const [result] = await connection.query(
            `INSERT INTO app_pcp_releases (codigo_liberacao, lote_info, data_pcp, usuario, qtd_ops, ops_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [codigo_liberacao, lote_info, data_pcp || null, usuario, qtd_ops || 0, ops_json || null]
        );

        if (ops_json) {
            try {
                const ops = JSON.parse(ops_json);
                for (const op of ops) {
                    if (op.is_fraction && op.fraction_id) {
                        await connection.query(
                            'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = ? WHERE id = ?',
                            [codigo_liberacao, op.fraction_id]
                        );
                    } else if (op.pedido && op.item) {
                        await connection.query(
                            'UPDATE app_sales_order_item_notes SET lpf_codigo = ? WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                            [codigo_liberacao, op.pedido.trim(), op.item.trim()]
                        );
                    }
                }
            } catch (err) {
                console.error('Error updating OPs with LPF code:', err);
            }
        }

        await connection.commit();
        console.log(`✅ Liberação PCP registrada: ${codigo_liberacao} (id=${result.insertId})`);
        res.json({ success: true, codigo_liberacao, id: result.insertId });
    } catch (err) {
        await connection.rollback();
        console.error('❌ [PCP RELEASE LOG ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// GET /api/pcp-releases/find/:codigo — Fetch single release to get PDF path
router.get('/find/:codigo', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT caminho_arquivo FROM app_pcp_releases WHERE codigo_liberacao = ?',
            [req.params.codigo]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Liberação não encontrada' });
        res.json({ success: true, caminho_arquivo: rows[0].caminho_arquivo });
    } catch (err) {
        console.error('❌ [PCP RELEASE FIND ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pcp-releases/download/:codigo — Download PDF
router.get('/download/:codigo', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT caminho_arquivo FROM app_pcp_releases WHERE codigo_liberacao = ?',
            [req.params.codigo]
        );
        if (rows.length === 0 || !rows[0].caminho_arquivo) {
            return res.status(404).json({ error: 'Arquivo não encontrado no banco' });
        }
        const filepath = rows[0].caminho_arquivo;
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Arquivo PDF não encontrado no disco' });
        }
        res.download(filepath);
    } catch (err) {
        console.error('❌ [PCP RELEASE DOWNLOAD ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pcp-releases — History with full filters + active lots
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, lote, pedido, produto, usuario, codigo } = req.query;
        const whereClauses = [];
        const params = [];

        if (startDate) {
            whereClauses.push(`data_hora >= ?`);
            params.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
            whereClauses.push(`data_hora <= ?`);
            params.push(`${endDate} 23:59:59`);
        }
        if (lote) {
            whereClauses.push(`(lote_info LIKE ? OR codigo_liberacao LIKE ?)`);
            params.push(`%${lote}%`, `%${lote}%`);
        }
        if (usuario) {
            whereClauses.push(`usuario LIKE ?`);
            params.push(`%${usuario}%`);
        }
        if (codigo) {
            whereClauses.push(`codigo_liberacao LIKE ?`);
            params.push(`%${codigo}%`);
        }
        if (pedido) {
            whereClauses.push(`ops_json LIKE ?`);
            params.push(`%"pedido":"${pedido}%`);
        }
        if (produto) {
            whereClauses.push(`ops_json LIKE ?`);
            params.push(`%${produto}%`);
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const [rows] = await mysqlPool.query(
            `SELECT id, codigo_liberacao, lote_info, data_pcp, usuario, qtd_ops, ops_json, caminho_arquivo, data_hora,
                    COALESCE(status, 'ABERTO') as status, data_liberacao, usuario_liberacao
             FROM app_pcp_releases ${whereSQL}
             ORDER BY data_hora DESC LIMIT 500`,
            params
        );

        const parsed = rows.map(r => ({
            ...r,
            status: r.status || 'ABERTO',
            ops: (() => { try { return JSON.parse(r.ops_json || '[]'); } catch { return []; } })()
        }));

        // Check for any active lpf_codigo in MySQL that is not yet in app_pcp_releases
        const registeredCodes = new Set(parsed.map(r => (r.codigo_liberacao || '').trim().toUpperCase()));

        const [notesLots] = await mysqlPool.query(`
            SELECT DISTINCT lpf_codigo, pedido, item, pcp_notes
            FROM app_sales_order_item_notes
            WHERE lpf_codigo IS NOT NULL AND lpf_codigo <> ''
        `);

        const [forecastLots] = await mysqlPool.query(`
            SELECT DISTINCT lpf_codigo, pedido, item, numero_lote, op_protheus, quantidade_pcp, data_entrega_pcp, id as fraction_id
            FROM app_pcp_delivery_forecasts
            WHERE lpf_codigo IS NOT NULL AND lpf_codigo <> ''
        `);

        const unregMap = new Map();

        notesLots.forEach(n => {
            const c = (n.lpf_codigo || '').trim().toUpperCase();
            if (c && !registeredCodes.has(c)) {
                if (!unregMap.has(c)) {
                    unregMap.set(c, {
                        id: `active-${c}`,
                        codigo_liberacao: c,
                        lote_info: c,
                        data_pcp: null,
                        usuario: 'PCP / Comercial',
                        qtd_ops: 0,
                        ops: [],
                        status: 'ABERTO',
                        data_liberacao: null,
                        usuario_liberacao: null,
                        caminho_arquivo: null,
                        data_hora: new Date().toISOString()
                    });
                }
                const lot = unregMap.get(c);
                lot.ops.push({
                    pedido: n.pedido,
                    item: n.item,
                    visual_op: `${n.pedido}-${n.item}`,
                    produto: '',
                    descricao: n.pcp_notes || '',
                    qtd: 0,
                    cliente: '',
                    entrega: '',
                    is_fraction: false
                });
            }
        });

        forecastLots.forEach(f => {
            const c = (f.lpf_codigo || '').trim().toUpperCase();
            if (c && !registeredCodes.has(c)) {
                if (!unregMap.has(c)) {
                    unregMap.set(c, {
                        id: `active-${c}`,
                        codigo_liberacao: c,
                        lote_info: c,
                        data_pcp: f.data_entrega_pcp || null,
                        usuario: 'PCP / Comercial',
                        qtd_ops: 0,
                        ops: [],
                        caminho_arquivo: null,
                        data_hora: new Date().toISOString()
                    });
                }
                const lot = unregMap.get(c);
                if (f.data_entrega_pcp && !lot.data_pcp) lot.data_pcp = f.data_entrega_pcp;
                lot.ops.push({
                    pedido: f.pedido,
                    item: f.item,
                    visual_op: f.op_protheus || f.numero_lote || `${f.pedido}-${f.item}`,
                    produto: '',
                    descricao: '',
                    qtd: Number(f.quantidade_pcp) || 0,
                    cliente: '',
                    entrega: f.data_entrega_pcp || '',
                    is_fraction: true,
                    fraction_letter: f.numero_lote,
                    fraction_id: f.fraction_id
                });
            }
        });

        const unregList = Array.from(unregMap.values()).map(lot => {
            lot.qtd_ops = lot.ops.length;
            return lot;
        });

        const allReleases = [...unregList, ...parsed];

        // Enrich missing client names or descriptions from Protheus (SC5 / SA1 / SB1)
        const allUniquePedidos = new Set();
        const allUniqueProdutos = new Set();

        allReleases.forEach(r => {
            if (Array.isArray(r.ops)) {
                r.ops.forEach(op => {
                    const p = String(op.pedido || '').trim();
                    if (p) allUniquePedidos.add(p);
                    const pr = String(op.codigo || op.produto || '').trim();
                    if (pr) allUniqueProdutos.add(pr);
                });
            }
        });

        const clientMap = new Map();
        const prodMap = new Map();

        if (allUniquePedidos.size > 0) {
            try {
                const pedList = Array.from(allUniquePedidos);
                const placeholders = pedList.map((_, i) => `$${i + 1}`).join(',');
                const clientRes = await db.query(`
                    SELECT DISTINCT TRIM(SC5.C5_NUM) as pedido, TRIM(SA1.A1_NOME) as nome_cliente
                    FROM SC5010 SC5
                    LEFT JOIN SA1010 SA1 ON SA1.A1_COD = SC5.C5_CLIENTE AND SA1.A1_LOJA = SC5.C5_LOJACLI AND SA1.D_E_L_E_T_ = ' '
                    WHERE SC5.D_E_L_E_T_ = ' ' AND TRIM(SC5.C5_NUM) IN (${placeholders})
                `, pedList);

                clientRes.rows.forEach(c => {
                    if (c.pedido && c.nome_cliente) clientMap.set(c.pedido, c.nome_cliente.trim());
                });
            } catch (e) {
                console.warn('[PCP Releases] Falha ao enriquecer clientes do Protheus:', e.message);
            }
        }

        if (allUniqueProdutos.size > 0) {
            try {
                const prodList = Array.from(allUniqueProdutos);
                const placeholders = prodList.map((_, i) => `$${i + 1}`).join(',');
                const prodRes = await db.query(`
                    SELECT DISTINCT TRIM(B1_COD) as codigo, TRIM(B1_DESC) as descricao
                    FROM SB1010
                    WHERE D_E_L_E_T_ = ' ' AND TRIM(B1_COD) IN (${placeholders})
                `, prodList);

                prodRes.rows.forEach(p => {
                    if (p.codigo && p.descricao) prodMap.set(p.codigo, p.descricao.trim());
                });
            } catch (e) {
                console.warn('[PCP Releases] Falha ao enriquecer produtos do Protheus:', e.message);
            }
        }

        allReleases.forEach(r => {
            if (Array.isArray(r.ops)) {
                r.ops.forEach(op => {
                    const p = String(op.pedido || '').trim();
                    const pr = String(op.codigo || op.produto || '').trim();
                    const fetchedClient = clientMap.get(p) || '';
                    if (!op.cliente || op.cliente === '-' || !op.nome_cliente) {
                        op.cliente = op.cliente && op.cliente !== '-' ? op.cliente : (fetchedClient || '—');
                        op.nome_cliente = op.nome_cliente && op.nome_cliente !== '-' ? op.nome_cliente : (fetchedClient || '—');
                    }
                    if (!op.descricao && pr && prodMap.has(pr)) {
                        op.descricao = prodMap.get(pr);
                    }
                });
            }
        });

        res.json(allReleases);
    } catch (err) {
        console.error('❌ [PCP RELEASE FETCH ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pcp-releases/save-pdf — Create folder and save PDF to network share
router.post('/save-pdf', async (req, res) => {
    try {
        const { codigo_liberacao, filename, pdfBase64 } = req.body;

        if (!codigo_liberacao || !filename || !pdfBase64) {
            return res.status(400).json({ error: 'Campos obrigatórios: codigo_liberacao, filename, pdfBase64.' });
        }

        // Sanitize folder name (remove illegal path chars)
        const safeCode = codigo_liberacao.replace(/[<>:"/\\|?*]/g, '-');
        const folderPath = path.join(OS_BASE_PATH, safeCode);

        // Create folder if it doesn't exist
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`📁 Pasta criada: ${folderPath}`);
        }

        // Write PDF file
        const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '-');
        const filePath = path.join(folderPath, safeFilename);
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        fs.writeFileSync(filePath, pdfBuffer);

        // Update database with the saved path
        await mysqlPool.query(
            `UPDATE app_pcp_releases SET caminho_arquivo = ? WHERE codigo_liberacao = ?`,
            [filePath, codigo_liberacao]
        );

        console.log(`✅ PDF salvo: ${filePath}`);
        res.json({ success: true, path: filePath });
    } catch (err) {
        console.error('❌ [SAVE PDF ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pcp-releases/create-or-assign-lot — Create or assign items to a manufacturing lot
router.post('/create-or-assign-lot', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
        const { codigo_lote, data_pcp, items, usuario, observacao } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item selecionado para incluir no lote.' });
        }

        let finalCodigo = codigo_lote ? String(codigo_lote).trim().toUpperCase() : null;
        if (!finalCodigo) {
            finalCodigo = await generateCodigoLiberacao(connection);
        }

        // Validação de integridade: nenhum item pode já pertencer a OUTRO lote diferente
        for (const item of items) {
            const pedClean = String(item.pedido || '').trim();
            const itemClean = String(item.item || '').trim();

            let existingLpf = null;
            if (item.is_fraction && item.fraction_id) {
                if (typeof item.fraction_id === 'number' || /^\d+$/.test(String(item.fraction_id))) {
                    const [fRows] = await connection.query(
                        'SELECT lpf_codigo FROM app_pcp_delivery_forecasts WHERE id = ?',
                        [item.fraction_id]
                    );
                    existingLpf = fRows[0]?.lpf_codigo;
                } else {
                    const [fRows] = await connection.query(
                        'SELECT lpf_codigo FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND (numero_lote = ? OR op_protheus LIKE ?)',
                        [pedClean, itemClean, item.fraction_letter || '', `%${item.fraction_letter || ''}`]
                    );
                    existingLpf = fRows[0]?.lpf_codigo;
                }
            } else if (pedClean && itemClean) {
                const [nRows] = await connection.query(
                    'SELECT lpf_codigo FROM app_sales_order_item_notes WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                    [pedClean, itemClean]
                );
                existingLpf = nRows[0]?.lpf_codigo;
                if (!existingLpf) {
                    const [fRows] = await connection.query(
                        'SELECT lpf_codigo FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? LIMIT 1',
                        [pedClean, itemClean]
                    );
                    existingLpf = fRows[0]?.lpf_codigo;
                }
            }

            if (existingLpf && String(existingLpf).trim().toUpperCase() !== String(finalCodigo).trim().toUpperCase()) {
                await connection.rollback();
                return res.status(400).json({
                    error: `Bloqueio: O item Pedido ${pedClean} / Item ${itemClean} já está inserido no lote ${existingLpf} e não pode ser repetido em outro lote. Remova-o do lote atual primeiro caso deseje transferi-lo.`
                });
            }
        }

        for (const item of items) {
            const pedClean = String(item.pedido || '').trim();
            const itemClean = String(item.item || '').trim();

            if (item.is_fraction && item.fraction_id) {
                if (typeof item.fraction_id === 'number' || /^\d+$/.test(String(item.fraction_id))) {
                    await connection.query(
                        'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = ?, data_entrega_pcp = COALESCE(?, data_entrega_pcp) WHERE id = ?',
                        [finalCodigo, data_pcp || null, item.fraction_id]
                    );
                } else {
                    await connection.query(
                        'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = ?, data_entrega_pcp = COALESCE(?, data_entrega_pcp) WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND (numero_lote = ? OR op_protheus LIKE ?)',
                        [finalCodigo, data_pcp || null, pedClean, itemClean, item.fraction_letter || '', `%${item.fraction_letter || ''}`]
                    );
                }
            } else if (pedClean && itemClean) {
                const [existingNotes] = await connection.query(
                    'SELECT id FROM app_sales_order_item_notes WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                    [pedClean, itemClean]
                );

                if (existingNotes.length > 0) {
                    await connection.query(
                        'UPDATE app_sales_order_item_notes SET lpf_codigo = ? WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                        [finalCodigo, pedClean, itemClean]
                    );
                } else {
                    await connection.query(
                        'INSERT INTO app_sales_order_item_notes (pedido, item, lpf_codigo, pcp_notes) VALUES (?, ?, ?, ?)',
                        [pedClean, itemClean, finalCodigo, observacao || null]
                    );
                }

                // If non-fraction, only update forecast if it is a single forecast row (not split)
                const [forecastCount] = await connection.query(
                    'SELECT id FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                    [pedClean, itemClean]
                );
                if (forecastCount.length <= 1) {
                    await connection.query(
                        'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = ?, data_entrega_pcp = COALESCE(?, data_entrega_pcp) WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                        [finalCodigo, data_pcp || null, pedClean, itemClean]
                    );
                }
            }
        }

        // Format items array for ops_json in app_pcp_releases
        const opsToSave = items.map(it => ({
            pedido: it.pedido,
            item: it.item,
            visual_op: it.visual_op || it.op_protheus || it.numero_lote || `${it.pedido}-${it.item}`,
            produto: it.codigo || it.produto || '',
            descricao: it.desc_produto || it.descricao || it.desc || '',
            qtd: parseFloat(it.visual_qtd || it.quantidade_pcp || it.quantidade || it.qtd_faturar || 0),
            cliente: it.nome_cliente || it.cliente || '',
            entrega: it.entrega || it.data_entrega_pcp || it.pcp_delivery_forecast_date || '',
            is_fraction: !!it.is_fraction,
            fraction_letter: it.fraction_letter || '',
            fraction_id: it.fraction_id || null
        }));

        const [existingRel] = await connection.query(
            'SELECT id, ops_json, qtd_ops FROM app_pcp_releases WHERE codigo_liberacao = ?',
            [finalCodigo]
        );

        if (existingRel.length > 0) {
            let combinedOps = opsToSave;
            try {
                const prevOps = JSON.parse(existingRel[0].ops_json || '[]');
                const opsMap = new Map();
                prevOps.forEach(op => {
                    const key = `${op.pedido}-${op.item}-${op.fraction_id || op.fraction_letter || ''}`;
                    opsMap.set(key, op);
                });
                opsToSave.forEach(op => {
                    const key = `${op.pedido}-${op.item}-${op.fraction_id || op.fraction_letter || ''}`;
                    opsMap.set(key, op);
                });
                combinedOps = Array.from(opsMap.values());
            } catch (e) {
                console.error('Error merging ops in release:', e);
            }

            await connection.query(
                `UPDATE app_pcp_releases 
                 SET lote_info = ?, data_pcp = COALESCE(?, data_pcp), usuario = COALESCE(?, usuario), qtd_ops = ?, ops_json = ?, data_hora = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [finalCodigo, data_pcp || null, usuario || null, combinedOps.length, JSON.stringify(combinedOps), existingRel[0].id]
            );
        } else {
            await connection.query(
                `INSERT INTO app_pcp_releases (codigo_liberacao, lote_info, data_pcp, usuario, qtd_ops, ops_json, data_hora)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [finalCodigo, finalCodigo, data_pcp || null, usuario || 'PCP / Comercial', opsToSave.length, JSON.stringify(opsToSave)]
            );
        }

        await connection.commit();
        console.log(`✅ Lote de Fabricação atualizado em app_pcp_releases: ${finalCodigo} (${items.length} itens vinculados)`);
        res.json({ success: true, codigo_lote: finalCodigo, count: items.length });
    } catch (err) {
        await connection.rollback();
        console.error('❌ [CREATE/ASSIGN LOT ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// POST /api/pcp-releases/remove-item-from-lot — Remove a single item/fraction from its lot
router.post('/remove-item-from-lot', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
        const { pedido, item, fraction_id, is_fraction, fraction_letter, codigo_lote } = req.body;
        const pedClean = String(pedido || '').trim();
        const itemClean = String(item || '').trim();
        let targetLpf = codigo_lote ? String(codigo_lote).trim().toUpperCase() : null;

        if (is_fraction && fraction_id) {
            if (typeof fraction_id === 'number' || /^\d+$/.test(String(fraction_id))) {
                if (!targetLpf) {
                    const [fRows] = await connection.query('SELECT lpf_codigo FROM app_pcp_delivery_forecasts WHERE id = ?', [fraction_id]);
                    targetLpf = fRows[0]?.lpf_codigo;
                }
                await connection.query(
                    'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = NULL WHERE id = ?',
                    [fraction_id]
                );
            } else {
                if (!targetLpf) {
                    const [fRows] = await connection.query('SELECT lpf_codigo FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND (numero_lote = ? OR op_protheus LIKE ?)', [pedClean, itemClean, fraction_letter || '', `%${fraction_letter || ''}`]);
                    targetLpf = fRows[0]?.lpf_codigo;
                }
                await connection.query(
                    'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = NULL WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND (numero_lote = ? OR op_protheus LIKE ?)',
                    [pedClean, itemClean, fraction_letter || '', `%${fraction_letter || ''}`]
                );
            }
        } else if (pedClean && itemClean) {
            if (!targetLpf) {
                const [nRows] = await connection.query('SELECT lpf_codigo FROM app_sales_order_item_notes WHERE TRIM(pedido) = ? AND TRIM(item) = ?', [pedClean, itemClean]);
                targetLpf = nRows[0]?.lpf_codigo;
            }
            await connection.query(
                'UPDATE app_sales_order_item_notes SET lpf_codigo = NULL WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                [pedClean, itemClean]
            );
            await connection.query(
                'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = NULL WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                [pedClean, itemClean]
            );
        }

        // Sincroniza app_pcp_releases (remove item do ops_json e atualiza qtd_ops)
        if (targetLpf) {
            const [relRows] = await connection.query(
                'SELECT id, ops_json, status FROM app_pcp_releases WHERE codigo_liberacao = ? OR lote_info = ?',
                [targetLpf, targetLpf]
            );
            if (relRows.length > 0) {
                const rel = relRows[0];
                try {
                    const prevOps = JSON.parse(rel.ops_json || '[]');
                    const filteredOps = prevOps.filter(op => {
                        const isMatch = String(op.pedido || '').trim() === pedClean && String(op.item || '').trim() === itemClean;
                        if (!isMatch) return true;
                        if (is_fraction && fraction_id) {
                            if (op.fraction_id && String(op.fraction_id) === String(fraction_id)) return false;
                            if (op.fraction_letter && String(op.fraction_letter) === String(fraction_letter)) return false;
                        }
                        return false;
                    });

                    if (filteredOps.length === 0 && rel.status !== 'LIBERADO') {
                        await connection.query('DELETE FROM app_pcp_releases WHERE id = ?', [rel.id]);
                    } else {
                        await connection.query(
                            'UPDATE app_pcp_releases SET ops_json = ?, qtd_ops = ? WHERE id = ?',
                            [JSON.stringify(filteredOps), filteredOps.length, rel.id]
                        );
                    }
                } catch (parseErr) {
                    console.warn('⚠️ Erro ao atualizar ops_json em remove-item-from-lot:', parseErr.message);
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Item removido do lote com sucesso.' });
    } catch (err) {
        await connection.rollback();
        console.error('❌ [REMOVE ITEM FROM LOT ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// POST /api/pcp-releases/liberar — Explicitly liberate aglutinated lot for manufacturing (irreversible)
router.post('/liberar', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
        const { id, codigo_liberacao, lote_info, usuario } = req.body;
        const targetId = id ? (typeof id === 'number' || /^\d+$/.test(id) ? parseInt(id, 10) : null) : null;
        const targetCode = String(codigo_liberacao || lote_info || '').trim();
        const userName = String(usuario || 'Usuário').trim();

        if (!targetId && !targetCode) {
            return res.status(400).json({ error: 'Identificador do lote não informado.' });
        }

        // Check if lot exists
        const [rows] = await connection.query(
            'SELECT id, codigo_liberacao, status FROM app_pcp_releases WHERE id = ? OR codigo_liberacao = ? OR lote_info = ? LIMIT 1',
            [targetId || 0, targetCode, targetCode]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Lote não encontrado.' });
        }

        const release = rows[0];

        // Update status to LIBERADO
        await connection.query(
            `UPDATE app_pcp_releases 
             SET status = 'LIBERADO', data_liberacao = NOW(), usuario_liberacao = ? 
             WHERE id = ?`,
            [userName, release.id]
        );

        await connection.commit();
        console.log(`🔒 [PCP RELEASE] Lote ${release.codigo_liberacao || release.id} LIBERADO por ${userName} (Irreversível)`);
        res.json({
            success: true,
            message: `Lote ${release.codigo_liberacao || release.id} liberado para fabricação com sucesso.`,
            status: 'LIBERADO'
        });
    } catch (err) {
        await connection.rollback();
        console.error('❌ [LIBERAR PCP RELEASE ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// POST /api/pcp-releases/dissolve-lot — Remove all items from a lot and remove release
router.post('/dissolve-lot', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
        const { codigo_lote } = req.body;
        if (!codigo_lote) return res.status(400).json({ error: 'Código do lote não informado.' });

        const cleanCode = String(codigo_lote).trim();

        // Check if lot is already LIBERADO
        const [checkRows] = await connection.query(
            'SELECT id, status FROM app_pcp_releases WHERE codigo_liberacao = ? OR lote_info = ? LIMIT 1',
            [cleanCode, cleanCode]
        );
        if (checkRows.length > 0 && checkRows[0].status === 'LIBERADO') {
            await connection.rollback();
            return res.status(403).json({ error: `O lote ${cleanCode} já está LIBERADO para fabricação e não pode ser desmanchado.` });
        }

        await connection.query(
            'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = NULL WHERE lpf_codigo = ?',
            [cleanCode]
        );
        await connection.query(
            'UPDATE app_sales_order_item_notes SET lpf_codigo = NULL WHERE lpf_codigo = ?',
            [cleanCode]
        );
        await connection.query(
            'DELETE FROM app_pcp_releases WHERE codigo_liberacao = ? OR lote_info = ?',
            [cleanCode, cleanCode]
        );

        await connection.commit();
        res.json({ success: true, message: `Lote ${cleanCode} desfeito com sucesso.` });
    } catch (err) {
        await connection.rollback();
        console.error('❌ [DISSOLVE LOT ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// DELETE /api/pcp-releases/:id — Delete release and unbind its items
router.delete('/:id', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
        const rawParam = String(req.params.id || '').trim();
        if (!rawParam) return res.status(400).json({ error: 'Identificador não fornecido.' });

        const isNumeric = /^\d+$/.test(rawParam);
        
        // Find release record by numeric ID or by codigo_liberacao / lote_info
        const [rows] = await connection.query(
            'SELECT id, codigo_liberacao, lote_info, ops_json, status FROM app_pcp_releases WHERE id = ? OR codigo_liberacao = ? OR lote_info = ?',
            [isNumeric ? parseInt(rawParam, 10) : 0, rawParam, rawParam]
        );

        // Check if any row is LIBERADO
        if (rows.some(r => r.status === 'LIBERADO')) {
            await connection.rollback();
            return res.status(403).json({ error: 'Este lote já está LIBERADO para fabricação e não pode ser excluído ou desfeito.' });
        }
        
        const codesToUnbind = new Set();
        codesToUnbind.add(rawParam);

        if (rows.length > 0) {
            for (const r of rows) {
                if (r.codigo_liberacao) codesToUnbind.add(r.codigo_liberacao);
                if (r.lote_info) codesToUnbind.add(r.lote_info);

                // If ops_json is present, unbind each item specifically
                if (r.ops_json) {
                    try {
                        const opsList = typeof r.ops_json === 'string' ? JSON.parse(r.ops_json) : r.ops_json;
                        if (Array.isArray(opsList)) {
                            for (const op of opsList) {
                                const p = String(op.pedido || '').trim();
                                const it = String(op.item || '').trim();
                                if (p && it) {
                                    await connection.query(
                                        'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = NULL WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                                        [p, it]
                                    );
                                    await connection.query(
                                        'UPDATE app_sales_order_item_notes SET lpf_codigo = NULL WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                                        [p, it]
                                    );
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing ops_json during delete:', e);
                    }
                }
            }
        }

        for (const code of codesToUnbind) {
            await connection.query(
                'UPDATE app_pcp_delivery_forecasts SET lpf_codigo = NULL WHERE lpf_codigo = ?',
                [code]
            );
            await connection.query(
                'UPDATE app_sales_order_item_notes SET lpf_codigo = NULL WHERE lpf_codigo = ?',
                [code]
            );
        }

        await connection.query(
            'DELETE FROM app_pcp_releases WHERE id = ? OR codigo_liberacao = ? OR lote_info = ?',
            [isNumeric ? parseInt(rawParam, 10) : 0, rawParam, rawParam]
        );

        await connection.commit();
        res.json({ success: true, message: 'Liberação excluída e itens desvinculados com sucesso.' });
    } catch (err) {
        await connection.rollback();
        console.error('❌ [DELETE PCP RELEASE ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// GET /api/pcp-releases/active-lots — List all active lots with item count & liberation status
router.get('/active-lots', async (req, res) => {
    try {
        const [rowsForecast] = await mysqlPool.query(`
            SELECT lpf_codigo, COUNT(*) as qtd_fracoes, SUM(quantidade_pcp) as total_pecas,
                   MIN(data_entrega_pcp) as data_pcp_min, MAX(data_entrega_pcp) as data_pcp_max
            FROM app_pcp_delivery_forecasts
            WHERE lpf_codigo IS NOT NULL AND lpf_codigo <> ''
            GROUP BY lpf_codigo
        `);

        const [rowsNotes] = await mysqlPool.query(`
            SELECT lpf_codigo, COUNT(*) as qtd_itens
            FROM app_sales_order_item_notes
            WHERE lpf_codigo IS NOT NULL AND lpf_codigo <> ''
            GROUP BY lpf_codigo
        `);

        const [releases] = await mysqlPool.query(`
            SELECT codigo_liberacao, lote_info, usuario, data_hora, caminho_arquivo, status
            FROM app_pcp_releases
        `);

        const releasesMap = new Map();
        releases.forEach(r => {
            if (r.codigo_liberacao) releasesMap.set(r.codigo_liberacao, r);
            if (r.lote_info) releasesMap.set(r.lote_info, r);
        });

        const lotMap = new Map();
        rowsForecast.forEach(rf => {
            lotMap.set(rf.lpf_codigo, {
                codigo: rf.lpf_codigo,
                qtd_itens: Number(rf.qtd_fracoes) || 0,
                total_pecas: Number(rf.total_pecas) || 0,
                data_pcp_min: rf.data_pcp_min,
                data_pcp_max: rf.data_pcp_max,
                release: releasesMap.get(rf.lpf_codigo) || null
            });
        });

        rowsNotes.forEach(rn => {
            if (!lotMap.has(rn.lpf_codigo)) {
                lotMap.set(rn.lpf_codigo, {
                    codigo: rn.lpf_codigo,
                    qtd_itens: Number(rn.qtd_itens) || 0,
                    total_pecas: 0,
                    data_pcp_min: null,
                    data_pcp_max: null,
                    release: releasesMap.get(rn.lpf_codigo) || null
                });
            } else {
                const cur = lotMap.get(rn.lpf_codigo);
                cur.qtd_itens = Math.max(cur.qtd_itens, Number(rn.qtd_itens) || 0);
            }
        });

        // Retornar SOMENTE Lotes que ainda NÃO foram liberados para fabricação (status !== 'LIBERADO')
        const unreleasedLots = Array.from(lotMap.values()).filter(lot => {
            const rel = releasesMap.get(lot.codigo);
            return !rel || rel.status !== 'LIBERADO';
        });

        res.json(unreleasedLots);
    } catch (err) {
        console.error('❌ [ACTIVE LOTS ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
