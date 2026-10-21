const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');
const { ACOES, registrarHistorico } = require('../services/opGuardService');

// 1. Explosão de Corte
router.post('/explosao', async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item fornecido para explosão.' });
    }

    try {
        const query = `
        SELECT DISTINCT 
            TRIM(sc2_filhas.c2_produto) as componente, 
            TRIM(sc2_filhas.c2_num) || TRIM(sc2_filhas.c2_item) || TRIM(sc2_filhas.c2_sequen) as op_numero, 
            sc2_filhas.c2_quant::numeric as qtd_necessaria, 
            TRIM(sb1.b1_desc) as descricao,
            TRIM(sg2.g2_recurso) as recurso, 
            sg2.g2_tempad as tempo_unitario,
            TRIM(sg1_mtc.g1_comp) as mtc_codigo,
            TRIM(sb1_mct.b1_desc) as mtc_descricao
        FROM sc2010 sc2_pai 
        JOIN sc2010 sc2_filhas ON sc2_filhas.c2_num = sc2_pai.c2_num AND sc2_filhas.d_e_l_e_t_ = '' 
        JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sc2_filhas.c2_produto) AND sb1.d_e_l_e_t_ = ''
        JOIN sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(sc2_filhas.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002') 
        LEFT JOIN sg1010 sg1_mtc ON TRIM(sg1_mtc.g1_cod) = TRIM(sc2_filhas.c2_produto) AND TRIM(sg1_mtc.g1_comp) LIKE 'MTC%' AND sg1_mtc.d_e_l_e_t_ = '' AND sg1_mtc.g1_filial = '0101' 
        LEFT JOIN sb1010 sb1_mct ON TRIM(sb1_mct.b1_cod) = TRIM(sg1_mtc.g1_comp) AND sb1_mct.d_e_l_e_t_ = ''
        WHERE sc2_pai.d_e_l_e_t_ = '' 
          AND TRIM(sc2_pai.c2_pedido) = $1 
          AND TRIM(sc2_pai.c2_itempv) = $2 
          AND TRIM(sc2_pai.c2_produto) = $3
        `;

        let resultados = [];

        // Para cada item selecionado, buscar os filhos
        for (const item of items) {
            const pedido = String(item.pedido).trim();
            const item_pv = String(item.item).trim();
            const produto_pai = String(item.codigo).trim();
            const op_num_full = item.op_num ? String(item.op_num).trim() : '';
            const c2_num = op_num_full.length >= 6 ? op_num_full.substring(0, 6) : '';

            let pgRes;
            
            if (c2_num) {
                // If we have the OP number, we query the child components directly matching the same c2_num
                const queryByOp = `
                SELECT DISTINCT 
                    TRIM(sc2_filhas.c2_produto) as componente, 
                    TRIM(sc2_filhas.c2_num) || TRIM(sc2_filhas.c2_item) || TRIM(sc2_filhas.c2_sequen) as op_numero, 
                    sc2_filhas.c2_quant::numeric as qtd_necessaria, 
                    TRIM(sb1.b1_desc) as descricao,
                    TRIM(sg2.g2_recurso) as recurso, 
                    sg2.g2_tempad as tempo_unitario,
                    TRIM(sg1_mtc.g1_comp) as mtc_codigo,
                    TRIM(sb1_mct.b1_desc) as mtc_descricao
                FROM sc2010 sc2_filhas 
                JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sc2_filhas.c2_produto) AND sb1.d_e_l_e_t_ = ''
                JOIN sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(sc2_filhas.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002') 
                LEFT JOIN sg1010 sg1_mtc ON TRIM(sg1_mtc.g1_cod) = TRIM(sc2_filhas.c2_produto) AND TRIM(sg1_mtc.g1_comp) LIKE 'MTC%' AND sg1_mtc.d_e_l_e_t_ = '' AND sg1_mtc.g1_filial = '0101' 
                LEFT JOIN sb1010 sb1_mct ON TRIM(sb1_mct.b1_cod) = TRIM(sg1_mtc.g1_comp) AND sb1_mct.d_e_l_e_t_ = ''
                WHERE sc2_filhas.d_e_l_e_t_ = '' 
                  AND sc2_filhas.c2_num = $1
                `;
                pgRes = await db.query(queryByOp, [c2_num]);
            } else {
                pgRes = await db.query(query, [pedido, item_pv, produto_pai]);
            }
            
            for (const row of pgRes.rows) {
                resultados.push({
                    pedido_pai: item.pedido,
                    item_pai: item.item,
                    produto_pai: produto_pai,
                    op_numero: row.op_numero,
                    componente: row.componente,
                    componente_descricao: row.descricao,
                    recurso: row.recurso, // MO0013 ou MO0002
                    recurso_nome: row.recurso === 'MO0013' ? 'Laser' : 'Puncionadeira',
                    tempo_unitario: parseFloat(row.tempo_unitario) || 0,
                    mtc_codigo: row.mtc_codigo || 'SEM_MTC',
                    mtc_descricao: row.mtc_descricao || 'Material não encontrado',
                    qtd_necessaria: parseFloat(row.qtd_necessaria) || 0
                });
            }
        }

        // Buscar roteiros completos em bulk para os componentes
        if (resultados.length > 0) {
            const allComponentes = [...new Set(resultados.map(r => r.componente))].filter(Boolean);
            if (allComponentes.length > 0) {
                try {
                    const roteiroQuery = `
                        SELECT TRIM(g2_produto) as produto, string_agg(TRIM(g2_recurso), '->' ORDER BY g2_operac) as roteiro
                        FROM sg2010
                        WHERE TRIM(g2_produto) = ANY($1) AND d_e_l_e_t_ = ''
                        GROUP BY TRIM(g2_produto)
                    `;
                    const roteiroRes = await db.query(roteiroQuery, [allComponentes]);
                    const roteiroMap = {};
                    roteiroRes.rows.forEach(row => {
                        roteiroMap[row.produto] = row.roteiro;
                    });
                    
                    resultados = resultados.map(r => ({
                        ...r,
                        roteiro: roteiroMap[r.componente] || ''
                    }));
                } catch (rotErr) {
                    console.error('Erro ao buscar roteiros em bulk:', rotErr.message);
                }
            }
        }

        // Buscar quais op_numero já existem na tabela app_lotes_corte_itens para marcar como already_loted
        if (resultados.length > 0) {
            const opNumeros = resultados.map(r => r.op_numero).filter(Boolean);
            if (opNumeros.length > 0) {
                const [lotedItens] = await mysqlPool.query(
                    `SELECT op_numero FROM app_lotes_corte_itens WHERE op_numero IN (?)`,
                    [opNumeros]
                );
                const lotedOpsSet = new Set(lotedItens.map(i => i.op_numero));
                
                // Marcar no resultado
                resultados = resultados.map(r => ({
                    ...r,
                    already_loted: lotedOpsSet.has(r.op_numero)
                }));
            }

            // Buscar apontamentos para abater a necessidade
            if (opNumeros.length > 0) {
                try {
                    const [appts] = await mysqlPool.query(
                        `SELECT CONCAT(TRIM(op_numero), TRIM(op_item), TRIM(op_sequencia)) as concat_op, 
                                SUM(quantidade) as total_produzido 
                         FROM app_production_appointments 
                         WHERE CONCAT(TRIM(op_numero), TRIM(op_item), TRIM(op_sequencia)) IN (?) 
                         GROUP BY concat_op`,
                        [opNumeros]
                    );
                    
                    const apptMap = {};
                    appts.forEach(a => { apptMap[a.concat_op] = parseFloat(a.total_produzido) || 0; });
                    
                    resultados = resultados.map(r => {
                        const produced = apptMap[r.op_numero] || 0;
                        const netQty = Math.max(0, r.qtd_necessaria - produced);
                        return {
                            ...r,
                            qtd_necessaria_original: r.qtd_necessaria,
                            qtd_produzida: produced,
                            qtd_necessaria: netQty
                        };
                    });
                    
                    // Filter out items that are already 100% produced
                    resultados = resultados.filter(r => r.qtd_necessaria > 0);
                } catch (apptErr) {
                    console.error('Erro ao buscar apontamentos para lote de corte:', apptErr.message);
                }
            }

            // Buscar desenhos em produtos_docs
            const componentes = [...new Set(resultados.map(r => r.componente))].filter(Boolean);
            if (componentes.length > 0) {
                try {
                    const [drawings] = await mysqlPool.query(
                        `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (?) AND tipo LIKE '%desenho%'`,
                        [componentes]
                    );
                    const drawingMap = {};
                    drawings.forEach(d => {
                        drawingMap[d.produto_codigo] = d.url_arquivo;
                    });
                    
                    resultados = resultados.map(r => ({
                        ...r,
                        has_drawing: !!drawingMap[r.componente],
                        pdf_path: drawingMap[r.componente] || null
                    }));
                } catch (drawErr) {
                    console.error('Erro ao buscar desenhos em produtos_docs:', drawErr.message);
                }
            }
        }

        res.json({ success: true, items: resultados });
    } catch (e) {
        console.error('=== ERRO /corte/explosao ===');
        console.error('Mensagem:', e.message);
        console.error('Stack:', e.stack);
        if (e.code) console.error('Código PG/MySQL:', e.code);
        if (e.query) console.error('Query:', e.query);
        res.status(500).json({ error: 'Falha ao processar explosão da estrutura.', details: e.message });
    }
});

// Sanitiza strings vindas do Protheus: remove o char de substituição Unicode (U+FFFD)
// que aparece quando Protheus armazena Latin-1 (Ç, Ã, etc.) e o PostgreSQL não decodifica corretamente
const sanitizeStr = (val, maxLen) => {
    if (val === null || val === undefined) return null;
    return String(val).replace(/�/g, '?').substring(0, maxLen);
};

// 2. Salvar Lotes de Corte
router.post('/lotes', async (req, res) => {
    const { lotes, usuario, gerar_planilha } = req.body;
    
    if (!lotes || !Array.isArray(lotes) || lotes.length === 0) {
        return res.status(400).json({ error: 'Nenhum lote fornecido.' });
    }

    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        let lotesGerados = [];

        // Obter número sequencial global inicial
        const [rowsCount] = await conn.query(`SELECT COUNT(*) as total FROM app_lotes_corte`);
        let nextSeqNum = (rowsCount[0]?.total || 0) + 1;

        for (const lote of lotes) {
            const nextSeq = String(nextSeqNum).padStart(6, '0');
            const materialCodigo = String(lote.material_codigo || 'SEM_MTC').substring(0, 30);
            const numero_lote = `LC-${new Date().getFullYear()}-${materialCodigo}-${nextSeq}`;
            nextSeqNum++;

            const [resultLote] = await conn.query(`
                INSERT INTO app_lotes_corte (numero_lote, recurso, material_codigo, material_descricao, usuario, observacao)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                numero_lote,
                sanitizeStr(lote.recurso, 20) || '',
                sanitizeStr(lote.material_codigo, 100) || '',
                sanitizeStr(lote.material_descricao, 255),
                sanitizeStr(usuario || 'Sistema', 100),
                sanitizeStr(lote.observacao, 500)
            ]);

            const loteId = resultLote.insertId;

            for (const item of lote.items) {
                const qtd = parseFloat(item.qtd_necessaria);
                await conn.query(`
                    INSERT INTO app_lotes_corte_itens
                    (lote_corte_id, pedido_pai, item_pai, produto_pai, op_numero, componente, componente_descricao, qtd_necessaria)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    loteId,
                    sanitizeStr(item.pedido_pai, 50) || '',
                    sanitizeStr(item.item_pai, 50) || '',
                    sanitizeStr(item.produto_pai, 100) || '',
                    sanitizeStr(item.op_numero, 50),
                    sanitizeStr(item.componente, 100) || '',
                    sanitizeStr(item.componente_descricao, 255),
                    isNaN(qtd) ? 0 : qtd
                ]);
            }

            lotesGerados.push(numero_lote);
        }

        // Se veio de um LPF / Lote Aglutinado, travar o status do LPF como LIBERADO automaticamente
        if (req.body.lpf_codigo) {
            const lpfClean = String(req.body.lpf_codigo).trim();
            await conn.query(
                `UPDATE app_pcp_releases 
                 SET status = 'LIBERADO', data_liberacao = NOW(), usuario_liberacao = ? 
                 WHERE codigo_liberacao = ? OR lote_info = ?`,
                [sanitizeStr(usuario || 'Sistema', 100), lpfClean, lpfClean]
            );
            console.log(`🔒 [CORTE LOTES] LPF ${lpfClean} marcado automaticamente como LIBERADO.`);
        }

        // Histórico: um registro por pedido/item que entrou no plano de corte
        const itensCorte = new Map();
        lotes.forEach((lote, idx) => (lote.items || []).forEach(it => {
            const k = `${String(it.pedido_pai || '').trim()}|${String(it.item_pai || '').trim()}`;
            if (!itensCorte.has(k)) itensCorte.set(k, { pedido: it.pedido_pai, item: it.item_pai, lotes: new Set(), ops: new Set() });
            itensCorte.get(k).lotes.add(lotesGerados[idx]);
            if (it.op_numero) itensCorte.get(k).ops.add(String(it.op_numero).trim());
        }));
        for (const ic of itensCorte.values()) {
            await registrarHistorico(conn, req, {
                acao: ACOES.PLANO_CORTE_GERADO,
                pedido: ic.pedido,
                item: ic.item,
                lote: req.body.lpf_codigo || null,
                descricao: `Plano de corte gerado: ${[...ic.lotes].join(', ')} (OPs filhas: ${[...ic.ops].join(', ') || '-'})${req.body.lpf_codigo ? ` | LPF ${req.body.lpf_codigo} LIBERADO` : ''}`,
                depois: { lotes_corte: [...ic.lotes], ops: [...ic.ops], lpf: req.body.lpf_codigo || null }
            });
        }

        await conn.commit();

        // ✅ Responder ao cliente IMEDIATAMENTE — antes de qualquer geração de arquivo
        res.json({ success: true, message: 'Lotes gerados com sucesso!', lotes: lotesGerados });

        // Preencher planilha de forma assíncrona (fire-and-forget) — não bloqueia a resposta
        if (gerar_planilha === true) {
            setImmediate(() => {
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const { exec } = require('child_process');

                    const templatePath = '\\\\192.168.1.253\\Estrutura Lynx\\023-SGQ\\023-001-FORMULARIOS\\Espelho OS-Corte.xls';
                    
                    const tempDir = path.join(__dirname, '../temp_files');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }

                    const timestamp = Date.now();
                    const outputFileName = `Espelho OS-Corte - ${lotesGerados[0] || 'Lote'}_${timestamp}.xls`;
                    const outputPath = path.join(tempDir, outputFileName);

                    if (!fs.existsSync(templatePath)) {
                        console.warn('[Excel] Template não acessível:', templatePath);
                        return;
                    }

                    console.log('[Excel] Gerando planilha via COM automation...');
                    const excelItemsMap = {};
                    for (const lote of lotes) {
                        const recursoNome = lote.recurso || 'Geral';
                        for (const item of lote.items) {
                            const key = `${item.componente}|${recursoNome}`;
                            if (!excelItemsMap[key]) {
                                excelItemsMap[key] = {
                                    componente: item.componente,
                                    qtd_necessaria: 0,
                                    material_descricao: lote.material_descricao || item.mtc_descricao || '',
                                    recurso_nome: recursoNome
                                };
                            }
                            excelItemsMap[key].qtd_necessaria += parseFloat(item.qtd_necessaria || 0);
                        }
                    }

                    const excelItems = Object.values(excelItemsMap);
                    const jsonPath = path.join(tempDir, `data_create_${timestamp}.json`);
                    fs.writeFileSync(jsonPath, JSON.stringify(excelItems));

                    const psScriptPath = path.join(__dirname, '../utils/fillExcelSilent.ps1');
                    exec(
                        `powershell.exe -ExecutionPolicy Bypass -File "${psScriptPath}" -jsonPath "${jsonPath}" -templatePath "${templatePath}" -outputPath "${outputPath}"`,
                        (execErr, stdout, stderr) => {
                            if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
                            if (execErr) {
                                console.error('[Excel] Erro na automação COM:', execErr.message, stderr);
                            } else {
                                console.log('[Excel] Planilha gerada:', outputPath);
                                exec(`cmd.exe /c start "" "${outputPath}"`, (openErr) => {
                                    if (openErr) console.error('[Excel] Erro ao abrir planilha:', openErr.message);
                                });
                            }
                        }
                    );
                } catch (excelErr) {
                    console.error('[Excel] Erro ao processar planilha:', excelErr.message);
                }
            });
        }
    } catch (e) {
        try { await conn.rollback(); } catch (_) {}
        console.error('=== ERRO /corte/lotes ===');
        console.error('Mensagem:', e.message);
        console.error('Código:', e.code);
        if (e.sql) console.error('SQL:', e.sql);
        res.status(500).json({ error: e.message, details: `${e.code || 'ERR'}: ${e.message}` });
    } finally {
        conn.release();
    }
});

// 2.5 Atualizar status_material
router.put('/lotes/:id/status-material', async (req, res) => {
    try {
        const { status_material } = req.body;
        await mysqlPool.query(
            'UPDATE app_lotes_corte SET status_material = ? WHERE id = ?',
            [status_material, req.params.id]
        );
        res.json({ success: true, message: 'Status atualizado com sucesso' });
    } catch (e) {
        console.error('Erro ao atualizar status do material:', e);
        res.status(500).json({ error: 'Erro ao atualizar status do material' });
    }
});

// 3. Listar Lotes Detalhados
router.get('/lotes-detalhados', async (req, res) => {
    try {
        const [lotes] = await mysqlPool.query(`
            SELECT * FROM app_lotes_corte ORDER BY id DESC LIMIT 100
        `);
        
        if (lotes.length === 0) {
            return res.json([]);
        }
        
        const loteIds = lotes.map(l => l.id);
        const [itens] = await mysqlPool.query(`
            SELECT *
            FROM app_lotes_corte_itens
            WHERE lote_corte_id IN (?)
        `, [loteIds]);

        // Fetch drawings
        const componentes = [...new Set(itens.map(i => i.componente))].filter(Boolean);
        const drawingMap = {};
        if (componentes.length > 0) {
            try {
                const [drawings] = await mysqlPool.query(
                    `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (?) AND tipo LIKE '%desenho%'`,
                    [componentes]
                );
                drawings.forEach(d => { drawingMap[d.produto_codigo] = d.url_arquivo; });
            } catch (drawErr) {
                console.error('Erro ao buscar desenhos para lotes detalhados:', drawErr.message);
            }
        }

        const itensComDesenho = itens.map(i => ({
            ...i,
            pdf_path: drawingMap[i.componente] || null
        }));

        const lotesComItens = lotes.map(l => ({
            ...l,
            items: itensComDesenho.filter(i => i.lote_corte_id === l.id)
        }));

        res.json(lotesComItens);
    } catch (e) {
        console.error('Erro ao buscar lotes detalhados:', e);
        res.status(500).json({ error: 'Erro ao buscar dados.' });
    }
});

// 4. Gerar e Baixar Excel para um Lote Existente
router.post('/lotes/:id/excel', async (req, res) => {
    const { id } = req.params;
    try {
        const [lotes] = await mysqlPool.query(`SELECT * FROM app_lotes_corte WHERE id = ?`, [id]);
        if (lotes.length === 0) {
            return res.status(404).json({ error: 'Lote não encontrado.' });
        }
        const lote = lotes[0];

        const [itens] = await mysqlPool.query(`SELECT * FROM app_lotes_corte_itens WHERE lote_corte_id = ?`, [id]);

        const fs = require('fs');
        const path = require('path');
        const xlsx = require('xlsx');

        const recursoNome = lote.recurso === 'MO0013' || lote.recurso === 'Laser' ? 'Laser' : 'Puncionadeira';

        // Agrupar itens por componente (soma qtd de pedidos distintos)
        const excelItemsMap = {};
        for (const item of itens) {
            const key = item.componente;
            if (!excelItemsMap[key]) {
                excelItemsMap[key] = {
                    componente: item.componente,
                    componente_descricao: item.componente_descricao || '',
                    qtd_necessaria: 0,
                };
            }
            excelItemsMap[key].qtd_necessaria += parseFloat(item.qtd_necessaria || 0);
        }
        const excelItems = Object.values(excelItemsMap);

        const dataFormatada = lote.data_criacao
            ? new Date(lote.data_criacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            : '';

        const sheetData = [
            ['ESPELHO OS - CORTE'],
            [],
            ['Número do Lote:', lote.numero_lote],
            ['Recurso:', recursoNome],
            ['Material:', `${lote.material_codigo || ''} - ${lote.material_descricao || ''}`],
            ['Data:', dataFormatada],
            ['Usuário:', lote.usuario || ''],
            ['Total de Componentes:', excelItems.length],
            [],
            ['Componente', 'Descrição', 'Qtd. Necessária', 'Recurso'],
        ];

        for (const item of excelItems) {
            sheetData.push([
                item.componente,
                item.componente_descricao,
                item.qtd_necessaria,
                recursoNome,
            ]);
        }

        const ws = xlsx.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 22 }, { wch: 52 }, { wch: 18 }, { wch: 18 }];

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Espelho OS-Corte');

        const tempDir = path.join(__dirname, '../temp_files');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const outputPath = path.join(tempDir, `Espelho_OS_Corte_${lote.numero_lote}_${timestamp}.xlsx`);
        xlsx.writeFile(wb, outputPath);

        res.download(outputPath, `${lote.numero_lote}.xlsx`, (err) => {
            try { fs.unlinkSync(outputPath); } catch (_) {}
            if (err) console.error('Erro ao enviar arquivo Excel:', err);
        });
    } catch (e) {
        console.error('=== ERRO /corte/lotes/:id/excel ===');
        console.error('Mensagem:', e.message);
        res.status(500).json({ error: e.message, details: `${e.code || 'ERR'}: ${e.message}` });
    }
});

// 5. Gerar Espelho OS-Corte para Lotes Existentes (download como blob, usando template real)
router.post('/lotes/exportar-espelho', async (req, res) => {
    const { loteIds } = req.body;

    if (!loteIds || !Array.isArray(loteIds) || loteIds.length === 0) {
        return res.status(400).json({ error: 'Nenhum lote selecionado.' });
    }

    try {
        const xlsx = require('xlsx');
        const path = require('path');

        const [lotes] = await mysqlPool.query(`SELECT * FROM app_lotes_corte WHERE id IN (?)`, [loteIds]);
        const [itens] = await mysqlPool.query(`SELECT * FROM app_lotes_corte_itens WHERE lote_corte_id IN (?)`, [loteIds]);

        // Agrupa por componente+recurso, somando quantidades (todos os lotes num único espelho)
        const excelItemsMap = {};
        for (const lote of lotes) {
            const loteItens = itens.filter(i => i.lote_corte_id === lote.id);
            const recursoNome = lote.recurso === 'MO0013' ? 'Laser' : 'Puncionadeira';
            for (const item of loteItens) {
                const key = `${item.componente}|${recursoNome}`;
                if (!excelItemsMap[key]) {
                    excelItemsMap[key] = {
                        componente: item.componente,
                        componente_descricao: item.componente_descricao || '',
                        qtd_necessaria: 0,
                        material_descricao: lote.material_descricao || '',
                        recurso_nome: recursoNome,
                    };
                }
                excelItemsMap[key].qtd_necessaria += parseFloat(item.qtd_necessaria || 0);
            }
        }

        const excelItems = Object.values(excelItemsMap);

        // Lê o template real para preservar formatação
        const templatePath = path.join(__dirname, '../templates/Espelho_OS_Corte_template.xls');
        const wb = xlsx.readFile(templatePath);

        // Usa a aba "Importação XLS" ou a primeira disponível
        const wsName = wb.SheetNames.find(n => n === 'Importação XLS') || wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        // Limpa dados antigos (A7:L200), mantendo cabeçalho do template (linhas 1-6)
        for (let row = 7; row <= 200; row++) {
            for (let col = 0; col < 12; col++) {
                const ref = xlsx.utils.encode_cell({ r: row - 1, c: col });
                if (ws[ref]) delete ws[ref];
            }
        }

        // Preenche dados a partir da linha 7 (A=componente, B=qtd, C=material)
        excelItems.forEach((item, i) => {
            const r = 6 + i; // 0-indexed → linha 7 = r:6
            ws[xlsx.utils.encode_cell({ r, c: 0 })] = { t: 's', v: String(item.componente) };
            ws[xlsx.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: item.qtd_necessaria };
            ws[xlsx.utils.encode_cell({ r, c: 2 })] = { t: 's', v: String(item.material_descricao) };
        });

        // Atualiza o range da planilha
        const lastRow = 7 + excelItems.length - 1;
        ws['!ref'] = `A1:L${Math.max(lastRow, 200)}`;

        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const filename = `Espelho_OS_Corte_${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.end(buf);

    } catch (e) {
        console.error('Erro no /lotes/exportar-espelho:', e);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao gerar espelho OS-Corte', details: e.message });
        }
    }
});

// 6. Atualizar status-material em lote (múltiplos lotes de uma vez)
router.put('/lotes/status-material-lote', async (req, res) => {
    const { loteIds, status_material } = req.body;
    if (!loteIds || !Array.isArray(loteIds) || loteIds.length === 0) {
        return res.status(400).json({ error: 'Nenhum lote informado.' });
    }
    if (!['Liberado', 'Pendente'].includes(status_material)) {
        return res.status(400).json({ error: 'Status inválido.' });
    }
    try {
        await mysqlPool.query(
            `UPDATE app_lotes_corte SET status_material = ? WHERE id IN (?)`,
            [status_material, loteIds]
        );
        res.json({ success: true, updated: loteIds.length });
    } catch (e) {
        console.error('Erro no /lotes/status-material-lote:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Routing Groups CRUD  (Grupos de Roteiro — exclusivos por recurso)
// ─────────────────────────────────────────────────────────────────────────────

// Garante tabela com coluna priority (migração idempotente)
async function ensureRoutingGroupsTable() {
    await mysqlPool.query(`CREATE TABLE IF NOT EXISTS app_routing_groups (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        rules       LONGTEXT NOT NULL,
        priority    INT NOT NULL DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    try { await mysqlPool.query('ALTER TABLE app_routing_groups ADD COLUMN priority INT NOT NULL DEFAULT 0'); } catch (_) {}
}

// Verifica se já existe um grupo com EXATAMENTE o mesmo conjunto de recursos
// Regra: combinações diferentes são permitidas ([MO0013] e [MO0013, MO0002] são grupos distintos)
async function isDuplicateCombination(newIncludes, excludeId = null) {
    const [rows] = await mysqlPool.query('SELECT id, rules FROM app_routing_groups');
    const newSorted = [...newIncludes].sort().join(',');
    for (const row of rows) {
        if (excludeId !== null && String(row.id) === String(excludeId)) continue;
        const rules = typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules;
        const existingSorted = [...(rules.includes || [])].map(r => r.toUpperCase()).sort().join(',');
        if (existingSorted === newSorted) return row.id;
    }
    return null;
}

router.get('/routing-groups', async (req, res) => {
    try {
        await ensureRoutingGroupsTable();
        const [rows] = await mysqlPool.query('SELECT * FROM app_routing_groups ORDER BY priority ASC, id ASC');
        const groups = rows.map(r => ({
            ...r,
            rules: typeof r.rules === 'string' ? JSON.parse(r.rules) : r.rules
        }));
        res.json({ success: true, groups });
    } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, groups: [] });
        console.error(e);
        res.status(500).json({ error: 'Erro ao buscar grupos.' });
    }
});

router.post('/routing-groups', async (req, res) => {
    try {
        await ensureRoutingGroupsTable();
        const { name, rules } = req.body;

        if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' });
        if (!rules?.expression?.trim()) return res.status(400).json({ error: 'Expressão não pode ser vazia.' });

        const expression = rules.expression.trim().toUpperCase();
        // Extract all resource codes from expression to validate duplicates
        const newIncludes = (expression.match(/[A-Z0-9_]+/g) || [])
            .filter(w => !['AND', 'OR', 'NOT', 'TRUE', 'FALSE'].includes(w))
            .sort();

        // Validação: não pode existir outro grupo com EXATAMENTE a mesma expressão
        const [rows] = await mysqlPool.query('SELECT id, rules FROM app_routing_groups');
        let dup = false;
        for (const row of rows) {
            let rRules = row.rules;
            if (typeof rRules === 'string') {
                try { rRules = JSON.parse(rRules); } catch (_) { continue; }
            }
            if (rRules.expression === expression) {
                dup = true;
                break;
            }
        }
        
        if (dup) {
            return res.status(409).json({
                error: `Já existe um grupo com exatamente essa mesma expressão.`
            });
        }

        const [[{ maxPri }]] = await mysqlPool.query('SELECT COALESCE(MAX(priority), -1) as maxPri FROM app_routing_groups');
        const rulesStr = JSON.stringify({
            expression,
            includes: newIncludes,
            excludes: []
        });
        await mysqlPool.query(
            'INSERT INTO app_routing_groups (name, rules, priority) VALUES (?, ?, ?)',
            [name.trim(), rulesStr, maxPri + 1]
        );
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro no servidor: ' + e.message });
    }
});

router.put('/routing-groups/:id', async (req, res) => {
    try {
        const { name, rules, priority } = req.body;
        const { id } = req.params;

        const newIncludes = (rules?.includes || []).map(r => String(r).trim().toUpperCase()).sort();
        if (newIncludes.length === 0) return res.status(400).json({ error: 'Selecione pelo menos um recurso.' });

        // Validação: combinação idêntica em outro grupo
        const dupId = await isDuplicateCombination(newIncludes, id);
        if (dupId) {
            return res.status(409).json({
                error: `Já existe um grupo com exatamente esses recursos.`
            });
        }

        const rulesStr = JSON.stringify({
            includes: newIncludes,
            excludes: [],
            condition: 'AND'
        });
        const updates = ['name = ?', 'rules = ?'];
        const params = [name.trim(), rulesStr];
        if (priority !== undefined) { updates.push('priority = ?'); params.push(Number(priority)); }
        params.push(id);
        await mysqlPool.query(`UPDATE app_routing_groups SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao atualizar grupo.' });
    }
});

router.delete('/routing-groups/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM app_routing_groups WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao excluir grupo.' });
    }
});

module.exports = router;
