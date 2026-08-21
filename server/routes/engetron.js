const express = require('express');
const router = express.Router();
const multer = require('multer');
const mysqlService = require('../services/mysqlService');
const protheusDB = require('../services/protheusDB');
const { invalidateForecastCache } = require('../services/forecastCache');

const upload = multer({ storage: multer.memoryStorage() });

// --- IMPORT EXCEL DATA ---
router.post('/importar-pcp', upload.single('file'), async (req, res) => {
    try {
        const { rows, usuario } = req.body;
        const pool = req.app.locals.mysqlPool || mysqlService;

        let parsedRows = [];
        try {
            parsedRows = typeof rows === 'string' ? JSON.parse(rows) : rows;
        } catch (e) {
            return res.status(400).json({ error: 'Erro ao fazer parse dos dados (JSON inválido).' });
        }

        if (!parsedRows || !Array.isArray(parsedRows) || parsedRows.length === 0) {
            return res.status(400).json({ error: 'Nenhuma linha enviada para importação.' });
        }

        let successCount = 0;
        let errorCount = 0;

        const toUpdate = [];
        const toInsert = [];
        const uniquePedidos = []; // Para deduplicação escopada depois

        let detailedResults = new Array(parsedRows.length).fill(null);

        // 1. Process and format rows
        for (let i = 0; i < parsedRows.length; i++) {
            const row = parsedRows[i];
            
            // Coluna C: Pedido Metalfisa (padding 6)
            let pedido = String(row.pedido || '').trim();
            if (!pedido && !row.item && !row.data_pcp) {
                detailedResults[i] = { status: 'warning', reason: 'Linha vazia' };
                continue;
            }
            if (!pedido) {
                detailedResults[i] = { status: 'error', reason: 'Sem Pedido' };
                continue;
            }
            pedido = pedido.padStart(6, '0');

            // Coluna B: Item do Pedido Metalfisa (padding 2)
            let item = String(row.item || '').trim();
            if (!item) {
                detailedResults[i] = { status: 'error', reason: 'Sem Item' };
                continue;
            }
            item = item.padStart(2, '0');

            // Coluna H: Data PCP
            const data_pcp = row.data_pcp || null;
            if (!data_pcp) {
                detailedResults[i] = { status: 'error', reason: 'Sem Data' };
                continue; // Pula se não tiver data
            }
            
            // Format data_pcp to YYYY-MM-DD
            let formattedDate = null;
            try {
                // xlsx might return ISO string or DD/MM/YYYY
                if (data_pcp.includes('/')) {
                    const parts = data_pcp.split(' ')[0].split('/'); // DD/MM/YYYY
                    if (parts.length === 3) {
                        formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }
                } else if (data_pcp.includes('-')) {
                    formattedDate = data_pcp.split('T')[0];
                }
            } catch (e) {
                console.error("Invalid date format", data_pcp);
                detailedResults[i] = { status: 'error', reason: 'Data Inválida' };
                continue;
            }
            if (!formattedDate) {
                detailedResults[i] = { status: 'error', reason: 'Data Inválida' };
                continue;
            }

            const entry = {
                pedido,
                item,
                data: formattedDate,
                qtd: row.qtd || 0, // Pode não ter quantidade, assumimos 0 se a intenção for só atualizar data
                _idx: i
            };

            const pedStr = `'${pedido}'`;
            if (!uniquePedidos.includes(pedStr)) uniquePedidos.push(pedStr);

            toUpdate.push(entry);
        }

        if (toUpdate.length === 0) {
            return res.json({ success: true, message: 'Nenhuma linha válida encontrada para atualizar.' });
        }

        // 2. Filtrar apenas pedidos do cliente ENGETRON ENG consultando o Protheus
        const pedPhPg = uniquePedidos.join(',');
        let validPedidosItems = {}; // { '004974_01': true }
        try {
            const pgClient = req.app.locals.db || protheusDB;
            const protheusRes = await pgClient.query(`
                SELECT c6.c6_num, c6.c6_item, a1.a1_nome, 
                       (c6.c6_qtdven - c6.c6_qtdent) as saldo,
                       c2.c2_num as op
                FROM public.sc6010 c6
                LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c6.c6_cli AND COALESCE(a1.d_e_l_e_t_, '') <> '*'
                LEFT JOIN public.sc2010 c2 ON TRIM(c2.c2_pedido) = TRIM(c6.c6_num) 
                                           AND c2.c2_itempv = c6.c6_item 
                                           AND c2.c2_sequen = '001' 
                                           AND COALESCE(c2.d_e_l_e_t_, '') = ''
                WHERE c6.c6_num IN (${pedPhPg})
                  AND COALESCE(c6.d_e_l_e_t_, '') NOT IN ('*', '  *')
            `);
            
            for (const row of protheusRes.rows) {
                const clienteNome = String(row.a1_nome || '').toUpperCase();
                const key = `${String(row.c6_num).trim()}_${String(row.c6_item).trim()}`;
                
                validPedidosItems[key] = {
                    isEngetron: clienteNome.includes('ENGETRON ENG') || clienteNome.includes('ENGETRON'),
                    hasSaldo: Number(row.saldo) > 0,
                    op: row.op ? String(row.op).trim() : 'SEM OP'
                };
            }
        } catch (e) {
            console.error('[Engetron] Erro ao consultar Protheus:', e);
            return res.status(500).json({ error: 'Erro ao validar o cliente dos pedidos no Protheus.' });
        }

        // Remove do array toUpdate tudo que não for do cliente válido
        const filteredToUpdate = [];
        for (const entry of toUpdate) {
            const val = validPedidosItems[`${entry.pedido}_${entry.item}`];
            if (val) {
                entry.op = val.op; // Guarda para usar depois
                if (val.isEngetron && val.hasSaldo) {
                    filteredToUpdate.push(entry);
                } else if (!val.isEngetron) {
                    detailedResults[entry._idx] = { status: 'warning', reason: 'Cliente Divergente', op: val.op };
                } else if (!val.hasSaldo) {
                    detailedResults[entry._idx] = { status: 'warning', reason: 'S/ Saldo (Já Faturado)', op: val.op };
                }
            } else {
                detailedResults[entry._idx] = { status: 'error', reason: 'Não Encontrado (Protheus)', op: '-' };
            }
        }
        
        if (filteredToUpdate.length === 0) {
            return res.json({ 
                success: true, 
                message: 'Nenhum pedido válido do cliente ENGETRON encontrado.',
                detailedResults 
            });
        }

        // 3. Fetch existing records in SINCO to decide UPDATE vs INSERT
        const pedPh = uniquePedidos.join(',');
        const [existing] = await pool.query(`
            SELECT id, pedido, item, op_protheus
            FROM app_pcp_delivery_forecasts
            WHERE pedido IN (${pedPh})
        `);

        // Group existing by pedido_item
        const existingMap = {};
        for (const ex of existing) {
            const key = `${ex.pedido}_${ex.item}`;
            if (!existingMap[key]) existingMap[key] = [];
            existingMap[key].push(ex);
        }

        const finalUpdates = [];
        const finalInserts = [];
        const uName = usuario || 'Engetron Planilha';

        for (const entry of filteredToUpdate) {
            const key = `${entry.pedido}_${entry.item}`;
            const matches = existingMap[key];

            if (matches && matches.length > 0) {
                // Update all matches for this pedido/item
                for (const match of matches) {
                    finalUpdates.push({
                        keepId: match.id,
                        data: entry.data
                    });
                }
                detailedResults[entry._idx] = { status: 'success', reason: 'PCP Atualizado', op: entry.op };
            } else {
                // If doesn't exist, insert
                finalInserts.push(entry);
                detailedResults[entry._idx] = { status: 'success', reason: 'Nova Data Inserida', op: entry.op };
            }
        }

        // 3. Execute BULK UPDATE
        if (finalUpdates.length > 0) {
            try {
                // Batch updates in chunks of 500
                const CHUNK = 500;
                for (let i = 0; i < finalUpdates.length; i += CHUNK) {
                    const chunk = finalUpdates.slice(i, i + CHUNK);
                    const ids = chunk.map(u => u.keepId);
                    const dataCases = chunk.map(u => `WHEN ${u.keepId} THEN ?`).join(' ');
                    const dataParams = chunk.map(u => u.data);
                    const idList = ids.map(() => '?').join(',');

                    await pool.query(
                        `UPDATE app_pcp_delivery_forecasts
                         SET data_entrega_pcp = CASE id ${dataCases} END,
                             usuario          = ?,
                             observacao       = ?
                         WHERE id IN (${idList})`,
                        [...dataParams, uName, 'Atualizado via Engetron (Planilha)', ...ids]
                    );
                    successCount += chunk.length;
                }
            } catch (e) {
                console.error('[Engetron] Erro no UPDATE em lote:', e.message);
                errorCount += finalUpdates.length;
            }
        }

        // 4. Execute BULK INSERT
        if (finalInserts.length > 0) {
            try {
                const CHUNK = 500;
                for (let i = 0; i < finalInserts.length; i += CHUNK) {
                    const chunk = finalInserts.slice(i, i + CHUNK);
                    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
                    const params = [];
                    for (const u of chunk) {
                        params.push(u.pedido, u.item, u.data, u.qtd, uName, 'Criado via Engetron (Planilha)');
                    }
                    await pool.query(
                        `INSERT INTO app_pcp_delivery_forecasts
                            (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao)
                         VALUES ${values}`,
                        params
                    );
                    successCount += chunk.length;
                }
            } catch (e) {
                console.error('[Engetron] Erro no INSERT em lote:', e.message);
                errorCount += finalInserts.length;
            }
        }

        if (typeof invalidateForecastCache === 'function') invalidateForecastCache();

        res.json({
            success: true,
            successCount,
            errorCount,
            message: `Lote processado. Atualizados/Inseridos: ${successCount}. Erros: ${errorCount}.`,
            detailedResults
        });

    } catch (err) {
        console.error('Error importing Engetron data:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
