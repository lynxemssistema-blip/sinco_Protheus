const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');

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
            TRIM(sg1_mtc.g1_comp) as mtc_codigo,
            TRIM(sb1_mct.b1_desc) as mtc_descricao 
        FROM sc2010 sc2_pai 
        JOIN sc2010 sc2_filhas ON sc2_filhas.c2_num = sc2_pai.c2_num AND sc2_filhas.d_e_l_e_t_ = '' 
        JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sc2_filhas.c2_produto) AND sb1.d_e_l_e_t_ = ''
        JOIN sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(sc2_filhas.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0012') 
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

            const pgRes = await db.query(query, [pedido, item_pv, produto_pai]);
            
            for (const row of pgRes.rows) {
                resultados.push({
                    pedido_pai: item.pedido,
                    item_pai: item.item,
                    produto_pai: produto_pai,
                    op_numero: row.op_numero,
                    componente: row.componente,
                    componente_descricao: row.descricao,
                    recurso: row.recurso, // MO0013 ou MO0012
                    recurso_nome: row.recurso === 'MO0013' ? 'Laser' : 'Puncionadeira',
                    mtc_codigo: row.mtc_codigo || 'SEM_MTC',
                    mtc_descricao: row.mtc_descricao || 'Material não encontrado',
                    qtd_necessaria: parseFloat(row.qtd_necessaria)
                });
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
        }

        res.json({ success: true, items: resultados });
    } catch (e) {
        console.error('Erro na explosão de corte:', e);
        res.status(500).json({ error: 'Falha ao processar explosão da estrutura.' });
    }
});

// 2. Salvar Lotes de Corte
router.post('/lotes', async (req, res) => {
    const { lotes, usuario } = req.body;
    
    if (!lotes || !Array.isArray(lotes) || lotes.length === 0) {
        return res.status(400).json({ error: 'Nenhum lote fornecido.' });
    }

    try {
        let lotesGerados = [];

        // Obter número sequencial global inicial
        const [rowsCount] = await mysqlPool.query(`SELECT COUNT(*) as total FROM app_lotes_corte`);
        let nextSeqNum = (rowsCount[0]?.total || 0) + 1;

        for (const lote of lotes) {
            const nextSeq = String(nextSeqNum).padStart(6, '0');
            const numero_lote = `LC-${new Date().getFullYear()}-${lote.material_codigo}-${nextSeq}`;
            nextSeqNum++;

            const [resultLote] = await mysqlPool.query(`
                INSERT INTO app_lotes_corte (numero_lote, recurso, material_codigo, material_descricao, usuario, observacao)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                numero_lote, 
                lote.recurso, 
                lote.material_codigo, 
                lote.material_descricao, 
                usuario || 'Sistema', 
                lote.observacao || null
            ]);

            const loteId = resultLote.insertId;

            for (const item of lote.items) {
                await mysqlPool.query(`
                    INSERT INTO app_lotes_corte_itens 
                    (lote_corte_id, pedido_pai, item_pai, produto_pai, op_numero, componente, componente_descricao, qtd_necessaria)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    loteId,
                    item.pedido_pai,
                    item.item_pai,
                    item.produto_pai,
                    item.op_numero,
                    item.componente,
                    item.componente_descricao,
                    item.qtd_necessaria
                ]);
            }
            
            lotesGerados.push(numero_lote);
        }

        // Preencher planilha e abrir para o usuário
        try {
            const fs = require('fs');
            const path = require('path');
            const xlsx = require('xlsx');
            const { exec } = require('child_process');

            const templatePath = '\\\\192.168.1.253\\Estrutura Lynx\\023-SGQ\\023-001-FORMULARIOS\\Espelho OS-Corte.xls';
            
            // Criar diretório temporário se não existir
            const tempDir = path.join(__dirname, '../temp_files');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const timestamp = Date.now();
            const outputFileName = `Espelho OS-Corte - ${lotesGerados[0] || 'Lote'}_${timestamp}.xls`;
            const outputPath = path.join(tempDir, outputFileName);

            if (fs.existsSync(templatePath)) {
                console.log('Lendo template de rede para preenchimento...');
                // Agrupar itens únicos de forma resumida
                const excelItemsMap = {};
                for (const lote of lotes) {
                    const recursoNome = lote.recurso === 'MO0013' ? 'Laser' : 'Puncionadeira';
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

                // Salvar JSON temporário para o PowerShell
                const jsonPath = path.join(tempDir, `data_create_${timestamp}.json`);
                fs.writeFileSync(jsonPath, JSON.stringify(excelItems));

                // Caminho do script PowerShell
                const psScriptPath = path.join(__dirname, '../utils/fillExcelSilent.ps1');

                // Executar o script PowerShell para preencher usando COM automation
                console.log('Executando automação COM no Excel...');
                exec(`powershell.exe -ExecutionPolicy Bypass -File "${psScriptPath}" -jsonPath "${jsonPath}" -templatePath "${templatePath}" -outputPath "${outputPath}"`, (execErr, stdout, stderr) => {
                    if (fs.existsSync(jsonPath)) {
                        fs.unlinkSync(jsonPath);
                    }
                    if (execErr) {
                        console.error('Erro na automação do Excel:', execErr, stderr);
                    } else {
                        console.log('Planilha gerada com sucesso via COM automation.');
                        exec(`cmd.exe /c start "" "${outputPath}"`, (openErr) => {
                            if (openErr) {
                                console.error('Erro ao abrir planilha com Excel:', openErr);
                            }
                        });
                    }
                });
            } else {
                console.error('Arquivo de template não acessível no caminho:', templatePath);
            }
        } catch (excelErr) {
            console.error('Erro ao processar planilha de corte:', excelErr);
        }

        res.json({ success: true, message: 'Lotes gerados com sucesso!', lotes: lotesGerados });
    } catch (e) {
        console.error('Erro ao salvar lotes de corte:', e);
        res.status(500).json({ error: 'Falha ao gravar os lotes no banco.' });
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

        const lotesComItens = lotes.map(l => ({
            ...l,
            items: itens.filter(i => i.lote_corte_id === l.id)
        }));

        res.json(lotesComItens);
    } catch (e) {
        console.error('Erro ao buscar lotes detalhados:', e);
        res.status(500).json({ error: 'Erro ao buscar dados.' });
    }
});

// 4. Gerar e Abrir Excel para um Lote Existente
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
        const { exec } = require('child_process');

        const templatePath = '\\\\192.168.1.253\\Estrutura Lynx\\023-SGQ\\023-001-FORMULARIOS\\Espelho OS-Corte.xls';
        
        const tempDir = path.join(__dirname, '../temp_files');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const outputFileName = `Espelho OS-Corte - ${lote.numero_lote}_${timestamp}.xls`;
        const outputPath = path.join(tempDir, outputFileName);

        if (!fs.existsSync(templatePath)) {
            return res.status(400).json({ error: 'Arquivo de template não acessível no caminho da rede.' });
        }

        // Agrupar itens únicos de forma resumida
        const excelItemsMap = {};
        const recursoNome = lote.recurso === 'MO0013' || lote.recurso === 'Laser' ? 'Laser' : 'Puncionadeira';
        
        for (const item of itens) {
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

        const excelItems = Object.values(excelItemsMap);

        // Salvar JSON temporário para o PowerShell
        const jsonPath = path.join(tempDir, `data_${timestamp}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(excelItems));

        // Caminho do script PowerShell
        const psScriptPath = path.join(__dirname, '../utils/fillExcelSilent.ps1');

        // Executar o script PowerShell para preencher usando COM automation
        exec(`powershell.exe -ExecutionPolicy Bypass -File "${psScriptPath}" -jsonPath "${jsonPath}" -templatePath "${templatePath}" -outputPath "${outputPath}"`, (execErr, stdout, stderr) => {
            // Limpar o JSON temporário
            if (fs.existsSync(jsonPath)) {
                fs.unlinkSync(jsonPath);
            }

            if (execErr) {
                console.error('Erro ao executar PowerShell para Excel:', execErr, stderr);
                return res.status(500).json({ error: 'Falha ao processar planilha via automação.' });
            }

            exec(`cmd.exe /c start "" "${outputPath}"`, (openErr) => {
                if (openErr) {
                    console.error('Erro ao abrir Excel:', openErr);
                }
            });

            res.download(outputPath, `${lote.numero_lote}.xls`, (err) => {
                if (err) {
                    console.error('Erro ao baixar arquivo:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Falha ao processar download do Excel.' });
                    }
                }
            });
        });
    } catch (e) {
        console.error('Erro ao gerar planilha do lote:', e);
        res.status(500).json({ error: 'Falha ao processar planilha.' });
    }
});

module.exports = router;
