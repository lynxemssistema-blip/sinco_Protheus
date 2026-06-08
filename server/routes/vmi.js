const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const multer = require('multer');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');

const upload = multer({ storage: multer.memoryStorage() });

// ── Init tables ──────────────────────────────────────────────────────────────
async function initTables() {
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS vmi_leituras (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            nome_arquivo    VARCHAR(255) NOT NULL,
            mes_referencia  VARCHAR(50)  NOT NULL,
            mes_label       VARCHAR(50)  DEFAULT NULL,
            sheet_name      VARCHAR(255) DEFAULT NULL,
            data_upload     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            usuario_id      INT          DEFAULT NULL,
            usuario_nome    VARCHAR(150) DEFAULT NULL,
            total_itens     INT          DEFAULT 0,
            total_pedidos   INT          DEFAULT 0,
            status          VARCHAR(20)  DEFAULT 'ativo',
            INDEX idx_mes (mes_referencia),
            INDEX idx_upload (data_upload)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS vmi_itens (
            id                  INT AUTO_INCREMENT PRIMARY KEY,
            leitura_id          INT             NOT NULL,
            codigo_produto      VARCHAR(60)     NOT NULL,
            descricao           TEXT            DEFAULT NULL,
            qtd_wk01            DECIMAL(12,3)   DEFAULT 0,
            qtd_wk02            DECIMAL(12,3)   DEFAULT 0,
            qtd_wk03            DECIMAL(12,3)   DEFAULT 0,
            qtd_wk04            DECIMAL(12,3)   DEFAULT 0,
            qtd_wk05            DECIMAL(12,3)   DEFAULT 0,
            faltantes_firmes    DECIMAL(12,3)   DEFAULT 0,
            entradas            DECIMAL(12,3)   DEFAULT 0,
            estoque_soc         DECIMAL(12,3)   DEFAULT 0,
            INDEX idx_leitura   (leitura_id),
            INDEX idx_codigo    (codigo_produto)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS vmi_itens_pedidos (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            leitura_id      INT             NOT NULL,
            item_id         INT             NOT NULL,
            numero_pedido   VARCHAR(50)     NOT NULL,
            quantidade      DECIMAL(12,3)   DEFAULT 0,
            INDEX idx_leitura (leitura_id),
            INDEX idx_item    (item_id),
            INDEX idx_pedido  (numero_pedido)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Tabela de metadados dos lotes importados (controle e deduplicação)
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS app_demanda_vmi_lotes (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            lote_id         VARCHAR(36)      NOT NULL UNIQUE,
            nome_arquivo    VARCHAR(255)     DEFAULT NULL,
            titulo          VARCHAR(255)     DEFAULT NULL,
            hash_conteudo   VARCHAR(64)      DEFAULT NULL,
            sheet_name      VARCHAR(255)     DEFAULT NULL,
            total_linhas    INT              DEFAULT 0,
            total_produtos  INT              DEFAULT 0,
            total_pedidos   INT              DEFAULT 0,
            total_quantidade DECIMAL(15,2)   DEFAULT 0,
            meses_referencia TEXT            DEFAULT NULL,
            usuario_id      INT              DEFAULT NULL,
            usuario_nome    VARCHAR(150)     DEFAULT NULL,
            created_at      DATETIME         DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_hash   (hash_conteudo),
            INDEX idx_nome   (nome_arquivo(191)),
            INDEX idx_data   (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

initTables().catch(err => console.error('❌ VMI table init error:', err.message));

// ── POST /api/vmi/leituras  — save a reading ─────────────────────────────────
router.post('/leituras', async (req, res) => {
    const { nome_arquivo, mes_referencia, mes_label, sheet_name, itens, pedidos_identificados } = req.body;

    if (!nome_arquivo || !mes_referencia || !Array.isArray(itens)) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Insert reading header
        const [leituraResult] = await conn.query(
            `INSERT INTO vmi_leituras
                (nome_arquivo, mes_referencia, mes_label, sheet_name, usuario_id, usuario_nome, total_itens, total_pedidos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_arquivo,
                mes_referencia,
                mes_label || null,
                sheet_name || null,
                req.user?.id || req.user?.idUsuario || null,
                req.user?.nome || req.user?.NomeCompleto || null,
                itens.length,
                Array.isArray(pedidos_identificados) ? pedidos_identificados.length : 0
            ]
        );
        const leituraId = leituraResult.insertId;

        // 2. Insert items one by one, collect order quantities for bulk insert
        const orderRows = []; // [leitura_id, item_id, numero_pedido, quantidade]

        for (const item of itens) {
            const [itemResult] = await conn.query(
                `INSERT INTO vmi_itens
                    (leitura_id, codigo_produto, descricao,
                     qtd_wk01, qtd_wk02, qtd_wk03, qtd_wk04, qtd_wk05,
                     faltantes_firmes, entradas, estoque_soc)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    leituraId,
                    item.codigo_produto,
                    item.descricao || null,
                    item.qtd_wk01 || 0,
                    item.qtd_wk02 || 0,
                    item.qtd_wk03 || 0,
                    item.qtd_wk04 || 0,
                    item.qtd_wk05 || 0,
                    item.faltantes_firmes || 0,
                    item.entradas || 0,
                    item.estoque_soc || 0
                ]
            );
            const itemId = itemResult.insertId;

            for (const [numero_pedido, quantidade] of Object.entries(item.pedidos || {})) {
                if (quantidade > 0) {
                    orderRows.push([leituraId, itemId, numero_pedido, quantidade]);
                }
            }
        }

        // 3. Bulk insert order quantities
        if (orderRows.length > 0) {
            await conn.query(
                `INSERT INTO vmi_itens_pedidos (leitura_id, item_id, numero_pedido, quantidade) VALUES ?`,
                [orderRows]
            );
        }

        await conn.commit();
        res.json({ id: leituraId, message: 'Leitura salva com sucesso!' });

    } catch (err) {
        await conn.rollback();
        console.error('❌ Erro ao salvar leitura VMI:', err);
        res.status(500).json({ error: 'Erro ao salvar leitura' });
    } finally {
        conn.release();
    }
});

// ── GET /api/vmi/leituras  — list readings ───────────────────────────────────
router.get('/leituras', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            `SELECT id, nome_arquivo, mes_referencia, mes_label, sheet_name,
                    data_upload, usuario_nome, total_itens, total_pedidos, status
             FROM vmi_leituras
             WHERE status = 'ativo'
             ORDER BY data_upload DESC
             LIMIT 100`
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Erro ao listar leituras VMI:', err);
        res.status(500).json({ error: 'Erro ao listar leituras' });
    }
});

// ── GET /api/vmi/leituras/:id  — reading detail ──────────────────────────────
router.get('/leituras/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [[leitura]] = await mysqlPool.query(
            'SELECT * FROM vmi_leituras WHERE id = ?', [id]
        );
        if (!leitura) return res.status(404).json({ error: 'Leitura não encontrada' });

        const [itens] = await mysqlPool.query(
            `SELECT i.id, i.codigo_produto, i.descricao,
                    i.qtd_wk01, i.qtd_wk02, i.qtd_wk03, i.qtd_wk04, i.qtd_wk05,
                    i.faltantes_firmes, i.entradas, i.estoque_soc,
                    (i.qtd_wk01 + i.qtd_wk02 + i.qtd_wk03 + i.qtd_wk04 + i.qtd_wk05) AS total_demanda
             FROM vmi_itens i
             WHERE i.leitura_id = ?
             ORDER BY total_demanda DESC, i.codigo_produto`,
            [id]
        );

        // Fetch order quantities per item
        const [pedidos] = await mysqlPool.query(
            `SELECT item_id, numero_pedido, quantidade
             FROM vmi_itens_pedidos
             WHERE leitura_id = ?
             ORDER BY numero_pedido`,
            [id]
        );

        // Group pedidos by item_id
        const pedidosByItem = {};
        for (const p of pedidos) {
            if (!pedidosByItem[p.item_id]) pedidosByItem[p.item_id] = {};
            pedidosByItem[p.item_id][p.numero_pedido] = p.quantidade;
        }

        const itensEnriched = itens.map(i => ({
            ...i,
            pedidos: pedidosByItem[i.id] || {}
        }));

        res.json({ ...leitura, itens: itensEnriched });

    } catch (err) {
        console.error('❌ Erro ao buscar leitura VMI:', err);
        res.status(500).json({ error: 'Erro ao buscar leitura' });
    }
});

// ── GET /api/vmi/estrategia/:id  — production strategy ───────────────────────
router.get('/estrategia/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [[leitura]] = await mysqlPool.query(
            'SELECT * FROM vmi_leituras WHERE id = ?', [id]
        );
        if (!leitura) return res.status(404).json({ error: 'Leitura não encontrada' });

        // All items with week quantities
        const [itens] = await mysqlPool.query(
            `SELECT id, codigo_produto, descricao,
                    qtd_wk01, qtd_wk02, qtd_wk03, qtd_wk04, qtd_wk05,
                    faltantes_firmes, entradas, estoque_soc,
                    (qtd_wk01+qtd_wk02+qtd_wk03+qtd_wk04+qtd_wk05) AS total_semanas
             FROM vmi_itens
             WHERE leitura_id = ?`,
            [id]
        );

        // Order quantities per item
        const [pedidos] = await mysqlPool.query(
            `SELECT item_id, numero_pedido, quantidade
             FROM vmi_itens_pedidos
             WHERE leitura_id = ?
             ORDER BY numero_pedido`,
            [id]
        );

        const pedidosByItem = {};
        for (const p of pedidos) {
            if (!pedidosByItem[p.item_id]) pedidosByItem[p.item_id] = [];
            pedidosByItem[p.item_id].push({ numero: p.numero_pedido, quantidade: +p.quantidade });
        }

        // Enrich each item with strategy metadata
        const itensEnriched = itens.map(item => {
            const wks = [+item.qtd_wk01, +item.qtd_wk02, +item.qtd_wk03, +item.qtd_wk04, +item.qtd_wk05];
            const wkIdx = wks.findIndex(q => q > 0); // 0-based (-1 = sem semana)
            const wkPrioritario = wkIdx === -1 ? 99 : wkIdx + 1; // 1-based WK

            const faltantes = +item.faltantes_firmes;

            // Status: critico = faltantes + urgente | atencao = faltantes ou wk01 | ok = resto
            let status;
            if (faltantes > 0 && wkPrioritario <= 2) status = 'critico';
            else if (faltantes > 0 || wkPrioritario === 1) status = 'atencao';
            else status = 'ok';

            const pedidosItem = pedidosByItem[item.id] || [];
            const totalPedidos = pedidosItem.reduce((s, p) => s + p.quantidade, 0);
            const totalGeral = Math.max(+item.total_semanas, totalPedidos);

            return {
                id: item.id,
                codigo_produto: item.codigo_produto,
                descricao: item.descricao,
                qtd_wk01: +item.qtd_wk01,
                qtd_wk02: +item.qtd_wk02,
                qtd_wk03: +item.qtd_wk03,
                qtd_wk04: +item.qtd_wk04,
                qtd_wk05: +item.qtd_wk05,
                total_semanas: +item.total_semanas,
                faltantes_firmes: faltantes,
                estoque_soc: +item.estoque_soc,
                entradas: +item.entradas,
                wk_prioritario: wkPrioritario,
                status,
                pedidos: pedidosItem,
                total_geral: totalGeral,
                // number of different orders that need this part
                num_pedidos: pedidosItem.length
            };
        });

        // Sort: status priority → WK asc → total desc
        const statusOrder = { critico: 0, atencao: 1, ok: 2 };
        itensEnriched.sort((a, b) => {
            if (statusOrder[a.status] !== statusOrder[b.status])
                return statusOrder[a.status] - statusOrder[b.status];
            if (a.wk_prioritario !== b.wk_prioritario)
                return a.wk_prioritario - b.wk_prioritario;
            return b.total_geral - a.total_geral;
        });

        // Group by WK
        const grupos = {};
        for (let w = 1; w <= 5; w++) {
            const label = `WK0${w}`;
            const items = itensEnriched.filter(i => i.wk_prioritario === w);
            if (items.length > 0) grupos[label] = items;
        }
        const semSemana = itensEnriched.filter(i => i.wk_prioritario === 99);
        if (semSemana.length > 0) grupos['SEM_SEMANA'] = semSemana;

        const resumo = {
            total_itens: itensEnriched.length,
            criticos: itensEnriched.filter(i => i.status === 'critico').length,
            atencao: itensEnriched.filter(i => i.status === 'atencao').length,
            ok: itensEnriched.filter(i => i.status === 'ok').length,
            total_pecas: itensEnriched.reduce((s, i) => s + i.total_geral, 0)
        };

        res.json({ leitura, grupos, resumo, itens: itensEnriched });

    } catch (err) {
        console.error('❌ Erro ao gerar estratégia VMI:', err);
        res.status(500).json({ error: 'Erro ao gerar estratégia' });
    }
});

// ── DELETE /api/vmi/leituras/:id  — soft delete ──────────────────────────────
router.delete('/leituras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(
            `UPDATE vmi_leituras SET status = 'excluido' WHERE id = ?`, [id]
        );
        res.json({ message: 'Leitura removida.' });
    } catch (err) {
        console.error('❌ Erro ao remover leitura VMI:', err);
        res.status(500).json({ error: 'Erro ao remover leitura' });
    }
});

// ── GET /api/vmi/comparativo  — compare two readings ─────────────────────────
router.get('/comparativo', async (req, res) => {
    const { id_anterior, id_atual } = req.query;
    if (!id_anterior || !id_atual) {
        return res.status(400).json({ error: 'Informe id_anterior e id_atual' });
    }
    try {
        // Items that appear in current but not in previous (new demand)
        const [novosDemanda] = await mysqlPool.query(
            `SELECT a.codigo_produto, a.descricao,
                    0 AS demanda_anterior,
                    (a.qtd_wk01+a.qtd_wk02+a.qtd_wk03+a.qtd_wk04+a.qtd_wk05) AS demanda_atual,
                    'novo' AS situacao
             FROM vmi_itens a
             WHERE a.leitura_id = ?
               AND a.codigo_produto NOT IN (
                   SELECT codigo_produto FROM vmi_itens WHERE leitura_id = ?
               )`,
            [id_atual, id_anterior]
        );

        // Items in both — compare total demand
        const [comparados] = await mysqlPool.query(
            `SELECT a.codigo_produto, a.descricao,
                    (b.qtd_wk01+b.qtd_wk02+b.qtd_wk03+b.qtd_wk04+b.qtd_wk05) AS demanda_anterior,
                    (a.qtd_wk01+a.qtd_wk02+a.qtd_wk03+a.qtd_wk04+a.qtd_wk05) AS demanda_atual,
                    CASE
                        WHEN (a.qtd_wk01+a.qtd_wk02+a.qtd_wk03+a.qtd_wk04+a.qtd_wk05) >
                             (b.qtd_wk01+b.qtd_wk02+b.qtd_wk03+b.qtd_wk04+b.qtd_wk05) THEN 'aumentou'
                        WHEN (a.qtd_wk01+a.qtd_wk02+a.qtd_wk03+a.qtd_wk04+a.qtd_wk05) <
                             (b.qtd_wk01+b.qtd_wk02+b.qtd_wk03+b.qtd_wk04+b.qtd_wk05) THEN 'diminuiu'
                        ELSE 'igual'
                    END AS situacao
             FROM vmi_itens a
             JOIN vmi_itens b ON b.codigo_produto = a.codigo_produto AND b.leitura_id = ?
             WHERE a.leitura_id = ?
             ORDER BY demanda_atual DESC`,
            [id_anterior, id_atual]
        );

        res.json({ novos: novosDemanda, comparados });

    } catch (err) {
        console.error('❌ Erro no comparativo VMI:', err);
        res.status(500).json({ error: 'Erro no comparativo' });
    }
});

// ── API ROUTES PARA DEMANDAS VMI OBTIDAS DO EXCEL ────────────────────────────

// Colunas fixas obrigatórias (índices 0–4). A partir do índice 5 são meses dinâmicos.
const MODELO_COLUNAS_FIXAS = [
    'Ordens de Compra',
    'Codigo',
    'Descricao',
    'CODIGO',
    'DESCRICAO',
];

// GET /api/vmi/modelo — retorna planilha modelo com cabeçalho e 2 linhas de exemplo (sem dados reais)
router.get('/modelo', (req, res) => {
    const wb = xlsx.utils.book_new();
    const header = [...MODELO_COLUNAS_FIXAS, 'Jan/26', 'Fev/26', 'Mar/26'];
    const example = [
        ['53277', '27.04.00389', 'SCANNER SPECTRUM 180180', '21.23.04497', 'SUPORTE FONTE WEG / AA_10055_02', 1, 0, 2],
        ['53278', '27.04.00390', 'SCANNER SPECTRUM 320KV',  '21.23.04498', 'TAMPA FONTE WEG / AA_10056_00',  0, 3, 0],
    ];
    const ws = xlsx.utils.aoa_to_sheet([header, ...example]);
    // Larguras de coluna
    ws['!cols'] = [
        { wch: 18 }, { wch: 16 }, { wch: 40 }, { wch: 20 }, { wch: 40 },
        { wch: 10 }, { wch: 10 }, { wch: 10 },
    ];
    xlsx.utils.book_append_sheet(wb, ws, 'Demanda VMI');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Modelo_Demanda_VMI.xlsx"');
    res.send(buffer);
});

// POST /api/vmi/upload
// Importador da planilha do VMI para o sistema
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

        // ── Verificação de duplicata (hash do conteúdo + nome do arquivo) ──────
        const fileHash = crypto.createHash('md5').update(req.file.buffer).digest('hex');
        const fileName = req.file.originalname;
        try {
            const [existente] = await mysqlPool.query(
                'SELECT nome_arquivo, created_at FROM app_demanda_vmi_lotes WHERE hash_conteudo = ? OR nome_arquivo = ? LIMIT 1',
                [fileHash, fileName]
            );
            if (existente && existente.length > 0) {
                const dt = new Date(existente[0].created_at).toLocaleString('pt-BR');
                return res.status(409).json({
                    error: `Planilha já importada em ${dt} (arquivo: "${existente[0].nome_arquivo}"). Use um arquivo diferente ou limpe a base antes de reimportar.`,
                    duplicado: true,
                    importado_em: existente[0].created_at,
                    nome_arquivo_original: existente[0].nome_arquivo
                });
            }
        } catch (_) { /* tabela pode não existir em ambiente legado */ }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Header padrão, array
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (!jsonData || jsonData.length < 3) {
            return res.status(400).json({ error: 'Planilha vazia ou sem dados.' });
        }

        // Encontrar a linha de cabeçalho dinamicamente (nas primeiras 10 linhas)
        let headerRowIdx = -1;
        let headers = null;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i];
            if (!row) continue;
            const rowStr = row.map(c => String(c || '').toUpperCase()).join('||');
            if (rowStr.includes('CÓDIGO') && rowStr.includes('DESCRIÇÃO')) {
                headerRowIdx = i;
                headers = row;
                break;
            }
        }

        if (headerRowIdx === -1 || !headers) {
            return res.status(400).json({ error: 'Planilha fora do modelo esperado. Não foi possível encontrar a linha de cabeçalho com CÓDIGO e DESCRIÇÃO.' });
        }

        const idxCodigo = headers.findIndex(h => h && String(h).toUpperCase() === 'CÓDIGO');
        const idxDescricao = headers.findIndex(h => h && String(h).toUpperCase() === 'DESCRIÇÃO');
        const idxEquip = headers.findIndex(h => h && String(h).toUpperCase().includes('EQUIPAMENTOS'));
        const idxPrioridade = headers.findIndex(h => h && String(h).toUpperCase().includes('PRIORIDADE'));

        if (idxCodigo === -1 || idxDescricao === -1) {
            return res.status(400).json({ error: 'Planilha sem as colunas CÓDIGO ou DESCRIÇÃO no cabeçalho.' });
        }

        // Find WK columns (any column that starts with WK)
        const wkCols = [];
        headers.forEach((h, i) => {
            if (h && String(h).toUpperCase().startsWith('WK')) {
                wkCols.push({ index: i, name: String(h).trim() });
            }
        });

        // Find Order columns (after "OC'S METALFISA")
        const idxOC = headers.findIndex(h => h && String(h).toUpperCase().includes("OC'S METALFISA"));
        const orderCols = [];
        if (idxOC !== -1) {
            for (let i = idxOC + 1; i < headers.length; i++) {
                if (headers[i] && String(headers[i]).trim() !== '') {
                    orderCols.push({ index: i, orderNum: String(headers[i]).trim() });
                }
            }
        }

        const loteId = uuidv4();
        let previewRows = [];

        // Ler dados a partir da linha após o cabeçalho
        for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !Array.isArray(row) || row.length === 0) continue;

            const prioridade = idxPrioridade !== -1 ? String(row[idxPrioridade] || '').trim() : '';
            const codigo_produto_cliente = String(row[idxCodigo] || '').trim();
            const descricao_produto_cliente = String(row[idxDescricao] || '').trim();
            const descricao_equipamento = idxEquip !== -1 ? String(row[idxEquip] || '').trim() : '';

            if (!codigo_produto_cliente && !descricao_produto_cliente) continue;

            // Extrair WKs
            let hasWKDemand = false;
            const wksData = {};
            wkCols.forEach(wk => {
                let val = row[wk.index];
                if (typeof val === 'string') val = val.replace(/\./g, '').replace(',', '.');
                const q = Number(val);
                if (!isNaN(q) && q > 0) {
                    wksData[wk.name] = q;
                    hasWKDemand = true;
                }
            });

            // Extrair Orders
            const itemOrders = [];
            orderCols.forEach(oc => {
                let val = row[oc.index];
                if (typeof val === 'string') val = val.replace(/\./g, '').replace(',', '.');
                const q = Number(val);
                if (!isNaN(q) && q > 0) {
                    itemOrders.push({ order: oc.orderNum, qty: q });
                }
            });

            if (itemOrders.length === 0) {
                // Produto sem nenhuma ordem, mas pode ter forecast (WKs)
                if (hasWKDemand) {
                    previewRows.push({
                        prioridade_cliente: prioridade,
                        ordem_compra_cliente: 'SEM_PEDIDO',
                        produto_pai: '',
                        descricao_equipamento,
                        codigo_produto_cliente,
                        descricao_produto_cliente,
                        rev_cliente: '',
                        meses: wksData
                    });
                }
                continue;
            }

            // Distribuir as WKs sequencialmente pelas Ordens
            let wksRemaining = { ...wksData };
            
            for (let k = 0; k < itemOrders.length; k++) {
                const orderData = itemOrders[k];
                const myWks = {};
                let orderRemaining = orderData.qty;

                for (const wkName of Object.keys(wksRemaining)) {
                    if (orderRemaining <= 0) break;
                    const wkQ = wksRemaining[wkName];
                    if (wkQ <= 0) continue;

                    const take = Math.min(wkQ, orderRemaining);
                    myWks[wkName] = take;
                    orderRemaining -= take;
                    wksRemaining[wkName] -= take;
                }

                if (Object.keys(myWks).length > 0) {
                    if (orderRemaining > 0) {
                        myWks['Saldo OC'] = orderRemaining;
                    }
                    previewRows.push({
                        prioridade_cliente: prioridade,
                        ordem_compra_cliente: orderData.order,
                        produto_pai: '',
                        descricao_equipamento,
                        codigo_produto_cliente,
                        descricao_produto_cliente,
                        rev_cliente: '',
                        meses: myWks
                    });
                } else if (orderData.qty > 0) {
                    // Sem WK, mas com saldo na OC
                    previewRows.push({
                        prioridade_cliente: prioridade,
                        ordem_compra_cliente: orderData.order,
                        produto_pai: '',
                        descricao_equipamento,
                        codigo_produto_cliente,
                        descricao_produto_cliente,
                        rev_cliente: '',
                        meses: { 'Saldo OC': orderData.qty }
                    });
                }
            }

            // Forecast extra
            const leftoverWks = {};
            let hasLeftover = false;
            for (const wkName of Object.keys(wksRemaining)) {
                if (wksRemaining[wkName] > 0) {
                    leftoverWks[wkName] = wksRemaining[wkName];
                    hasLeftover = true;
                }
            }
            if (hasLeftover) {
                previewRows.push({
                    prioridade_cliente: prioridade,
                    ordem_compra_cliente: 'FORECAST_S_OC',
                    produto_pai: '',
                    descricao_equipamento,
                    codigo_produto_cliente,
                    descricao_produto_cliente,
                    rev_cliente: '',
                    meses: leftoverWks
                });
            }
        }

        if (previewRows.length === 0) {
            return res.status(400).json({ error: 'Nenhum dado válido para importar. Todas as quantidades numéricas estão zeradas.' });
        }

        const extractedMonths = [...new Set(previewRows.flatMap(r => Object.keys(r.meses)))];

        // Return preview data without DB insertion
        res.json({
            success: true,
            msg: `Planilha lida com sucesso. Encontradas ${previewRows.length} linhas de demanda com WKs distribuídas.`,
            preview_data: previewRows,
            meses: extractedMonths,
            _import_meta: {
                nome_arquivo: fileName,
                hash_conteudo: fileHash,
                sheet_name: sheetName,
                total_linhas: previewRows.length,
                meses: extractedMonths
            }
        });

    } catch (err) {
        console.error('Erro na leitura VMI:', err);
        res.status(500).json({ error: 'Erro interno ao processar a planilha.', details: err.message });
    }
});

// POST /api/vmi/save-lote
// Salva as demandas aprovadas pelo usuário no BD
router.post('/save-lote', async (req, res) => {
    try {
        const { records, _import_meta } = req.body;
        if (!records || records.length === 0) {
            return res.status(400).json({ error: 'Nenhum registro para salvar.' });
        }

        const loteId = uuidv4();
        const now = new Date();

        // Formating for bulk insert (Flattening)
        const pushParams = [];
        records.forEach(r => {
            for (const [mes, qtd] of Object.entries(r.meses || {})) {
                pushParams.push([
                    loteId,
                    r.ordem_compra_cliente,
                    r.produto_pai,
                    r.descricao_equipamento,
                    r.codigo_produto_cliente,
                    r.descricao_produto_cliente,
                    r.rev_cliente, // Added rev_cliente
                    mes,
                    qtd,
                    now, // Added created_at
                    r.prioridade_cliente || null
                ]);
            }
        });

        // Bulk insert em chunks para não estourar a memória (max 1000 param sets no Mysql)
        const CHUNK_SIZE = 500;
        let insertedRows = 0;

        for (let i = 0; i < pushParams.length; i += CHUNK_SIZE) {
            const chunk = pushParams.slice(i, i + CHUNK_SIZE);
            const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(','); // 11 placeholders
            const flatParams = chunk.flat();

            await mysqlPool.execute(`
                INSERT INTO app_demanda_vmi (
                    lote_importacao, ordem_compra_cliente, produto_pai, descricao_equipamento,
                    codigo_produto_cliente, descricao_produto_cliente, rev_cliente,
                    mes_referencia, quantidade, created_at, prioridade_cliente
                ) VALUES ${placeholders}
            `, flatParams);

            insertedRows += chunk.length;
        }

        // Registra metadados do lote na tabela de controle
        if (_import_meta) {
            try {
                const uniqueProds = new Set(records.map(r => r.codigo_produto_cliente)).size;
                const uniqueOrders = new Set(records.map(r => r.ordem_compra_cliente)).size;
                const totalQtd = records.reduce((s, r) =>
                    s + Object.values(r.meses || {}).reduce((a, b) => a + Number(b), 0), 0);
                const mesesList = [...new Set(records.flatMap(r => Object.keys(r.meses || {})))].join(', ');

                await mysqlPool.execute(`
                    INSERT INTO app_demanda_vmi_lotes
                        (lote_id, nome_arquivo, hash_conteudo, sheet_name,
                         total_linhas, total_produtos, total_pedidos, total_quantidade,
                         meses_referencia, usuario_id, usuario_nome)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    loteId,
                    _import_meta.nome_arquivo || null,
                    _import_meta.hash_conteudo || null,
                    _import_meta.sheet_name || null,
                    _import_meta.total_linhas || records.length,
                    uniqueProds,
                    uniqueOrders,
                    totalQtd,
                    mesesList,
                    req.user?.id || req.user?.idUsuario || null,
                    req.user?.nome || req.user?.NomeCompleto || null
                ]);
            } catch (metaErr) {
                console.error('Aviso: erro ao salvar metadados do lote:', metaErr.message);
            }
        }

        res.json({
            success: true,
            msg: `Base VMI atualizada! Foram importados ${insertedRows} registros.`
        });

    } catch (err) {
        console.error('Erro na gravação VMI:', err);
        res.status(500).json({ error: 'Erro interno ao gravar os dados aprovados.', details: err.message });
    }
});

// GET /api/vmi/demandas
// Aceita ?lote=uuid para filtrar por lote específico (padrão: mais recente)
router.get('/demandas', async (req, res) => {
    try {
        let loteSelecionado = req.query.lote || null;

        if (!loteSelecionado) {
            // Tenta a tabela de lotes primeiro (mais rápida), depois fallback legado
            const [loteRow] = await mysqlPool.query(
                'SELECT lote_id FROM app_demanda_vmi_lotes ORDER BY created_at DESC LIMIT 1'
            );
            if (loteRow && loteRow.length > 0) {
                loteSelecionado = loteRow[0].lote_id;
            } else {
                const [oldRow] = await mysqlPool.query(
                    'SELECT lote_importacao FROM app_demanda_vmi ORDER BY created_at DESC LIMIT 1'
                );
                if (!oldRow || oldRow.length === 0) {
                    return res.json({ data: [], meta: { message: 'Sem dados' } });
                }
                loteSelecionado = oldRow[0].lote_importacao;
            }
        }

        const [rows] = await mysqlPool.query(`
            SELECT
                id, lote_importacao, prioridade_cliente, ordem_compra_cliente, produto_pai,
                descricao_equipamento, codigo_produto_cliente, descricao_produto_cliente,
                rev_cliente, mes_referencia, quantidade, created_at
            FROM app_demanda_vmi
            WHERE lote_importacao = ?
            ORDER BY ordem_compra_cliente ASC, codigo_produto_cliente ASC, mes_referencia ASC
        `, [loteSelecionado]);

        // --- ENRIQUECIMENTO COM CLASSIFICAÇÃO PROTHEUS ---
        if (rows.length > 0) {
            try {
                const codigosCliente = [...new Set(rows.map(r => r.codigo_produto_cliente).filter(Boolean))];
                
                if (codigosCliente.length > 0) {
                    // 1. Busca mapeamentos no MySQL
                    const [mapRows] = await mysqlPool.execute(
                        `SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map 
                         WHERE codigo_produto_cliente IN (${codigosCliente.map(() => '?').join(',')})`,
                        codigosCliente
                    );
                    
                    const mapeamentoMap = {};
                    mapRows.forEach(m => { mapeamentoMap[m.codigo_produto_cliente] = m.b1_cod; });

                    // 1b. Auto-match para códigos não mapeados, removendo caracteres especiais
                    const unmappedCodes = codigosCliente.filter(c => !mapeamentoMap[c]);
                    if (unmappedCodes.length > 0) {
                        const cleanToOriginal = {};
                        unmappedCodes.forEach(c => {
                            const clean = c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                            if (clean) cleanToOriginal[clean] = c;
                        });

                        const cleanCodes = Object.keys(cleanToOriginal);
                        if (cleanCodes.length > 0) {
                            try {
                                const autoMatchQuery = `
                                    SELECT TRIM(b1_cod) as b1_cod
                                    FROM public.sb1010
                                    WHERE TRIM(b1_cod) = ANY($1::text[])
                                    AND COALESCE(d_e_l_e_t_, '') = ''
                                `;
                                const autoMatchResult = await db.query(autoMatchQuery, [cleanCodes]);
                                autoMatchResult.rows.forEach(r => {
                                    const cleanFound = r.b1_cod.toUpperCase();
                                    const orig = cleanToOriginal[cleanFound];
                                    if (orig) mapeamentoMap[orig] = r.b1_cod;
                                });
                            } catch (errAuto) {
                                console.error('Erro no auto-match de b1_cod:', errAuto.message);
                            }
                        }
                    }

                    // Inicialização padrão de status como Restrição para itens não mapeados
                    rows.forEach(row => {
                        row.status_tipo_item = 'Restrição';
                        row.status_tipo_detalhe = 'Produto do cliente sem mapeamento de código Protheus/Metalfisa.';
                        row.b1_cod = null;
                        row.b1_desc = null;
                    });

                    const b1Cods = [...new Set(Object.values(mapeamentoMap))];
                    
                    if (b1Cods.length > 0) {
                        // 2. Busca Status no Postgres (Protheus)
                        const queryStatus = `
                            SELECT 
                                TRIM(sb1.b1_cod) as b1_cod,
                                TRIM(sb1.b1_desc) as b1_desc,
                                (SELECT STRING_AGG(DISTINCT TRIM(z1.z1_revisao), ' / ') FROM public.sz1010 z1 WHERE TRIM(z1.z1_produto) = TRIM(sb1.b1_cod) AND COALESCE(z1.d_e_l_e_t_, '') = '') as rev_protheus,
                                CASE
                                    -- 1. Restrição
                                    WHEN sb1.b1_msblql IN ('1','S','T','Y') OR EXISTS (
                                        SELECT 1 FROM public.sz0010 sz0 
                                        WHERE TRIM(sz0.z0_produto) = TRIM(sb1.b1_cod) 
                                        AND sz0.z0_status = 'P' 
                                        AND COALESCE(sz0.d_e_l_e_t_, '') = ''
                                    ) THEN 'Restrição'
                                    
                                    -- 2. Novo
                                    WHEN NOT EXISTS (SELECT 1 FROM public.sg1010 sg1 WHERE TRIM(sg1.g1_cod) = TRIM(sb1.b1_cod) AND COALESCE(sg1.d_e_l_e_t_, '') = '')
                                     AND NOT EXISTS (SELECT 1 FROM public.sg2010 sg2 WHERE TRIM(sg2.g2_produto) = TRIM(sb1.b1_cod) AND COALESCE(sg2.d_e_l_e_t_, '') = '') THEN 'Novo'
                                    
                                    -- 3. PCP (Default)
                                    ELSE 'PCP'
                                END as status_tipo_item_base,
                                CASE
                                    WHEN sb1.b1_msblql IN ('1','S','T','Y') THEN 'Produto bloqueado no cadastro (SB1 b1_msblql).'
                                    WHEN EXISTS (SELECT 1 FROM public.sz0010 sz0 WHERE TRIM(sz0.z0_produto) = TRIM(sb1.b1_cod) AND sz0.z0_status = 'P' AND COALESCE(sz0.d_e_l_e_t_, '') = '') THEN 'Restrição pendente no cadastro (SZ0 status=P).'
                                    WHEN NOT EXISTS (SELECT 1 FROM public.sg1010 sg1 WHERE TRIM(sg1.g1_cod) = TRIM(sb1.b1_cod) AND COALESCE(sg1.d_e_l_e_t_, '') = '')
                                     AND NOT EXISTS (SELECT 1 FROM public.sg2010 sg2 WHERE TRIM(sg2.g2_produto) = TRIM(sb1.b1_cod) AND COALESCE(sg2.d_e_l_e_t_, '') = '') THEN 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.'
                                    ELSE 'Item liberado para PCP.'
                                END as status_tipo_detalhe_base
                            FROM public.sb1010 sb1
                            WHERE TRIM(sb1.b1_cod) IN (${b1Cods.map((_, i) => `$${i + 1}`).join(',')})
                            AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                        `;

                        const pgResult = await db.query(queryStatus, b1Cods);
                        const statusMap = {};
                        pgResult.rows.forEach(r => { statusMap[r.b1_cod] = r; });

                        // 3. Mescla os dados
                        rows.forEach(row => {
                            const b1Cod = mapeamentoMap[row.codigo_produto_cliente];
                            if (b1Cod && statusMap[b1Cod]) {
                                const s = statusMap[b1Cod];
                                row.b1_cod = b1Cod;
                                row.b1_desc = s.b1_desc;

                                // Lógica de Revisão: Compara rev_cliente da planilha com rev_protheus (SZ1)
                                const revsProtheus = (s.rev_protheus || '').split(' / ').map(v => v.trim());
                                const revVmi = (row.rev_cliente || '').trim();

                                if (revVmi && revsProtheus.length > 0 && !revsProtheus.includes(revVmi)) {
                                    row.status_tipo_item = 'Revisão';
                                    row.status_tipo_detalhe = `Diferença de revisão. VMI: ${revVmi} / Protheus: ${s.rev_protheus}`;
                                } else {
                                    row.status_tipo_item = s.status_tipo_item_base;
                                    row.status_tipo_detalhe = s.status_tipo_detalhe_base;
                                }
                            } else if (b1Cod) {
                                row.status_tipo_item = 'Restrição';
                                row.status_tipo_detalhe = 'Produto mapeado não encontrado no Protheus (SB1).';
                            }
                        });
                    }

                    // 4. Busca b1_cod dos produtos PAI:
                    //    Primeiro tenta via mapeamento MySQL, depois confirma/complementa via SB1 Protheus
                    const codigosPai = [...new Set(rows.map(r => r.produto_pai).filter(Boolean))];
                    if (codigosPai.length > 0) {
                        // 4a. Lookup no mapeamento MySQL
                        const [paiMapRows] = await mysqlPool.execute(
                            `SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map
                             WHERE codigo_produto_cliente IN (${codigosPai.map(() => '?').join(',')})`,
                            codigosPai
                        );
                        const paiMapMySQL = {};
                        paiMapRows.forEach(m => { paiMapMySQL[m.codigo_produto_cliente] = m.b1_cod; });

                        // 4b. Para os que não encontraram no MySQL, tenta buscar no Protheus SB1
                        //     usando o código normalizado (sem caracteres especiais)
                        const semMapeamento = codigosPai.filter(c => !paiMapMySQL[c]);
                        const paiMapSB1 = {};
                        if (semMapeamento.length > 0) {
                            const codigosNorm = semMapeamento.map(c => c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
                            const uniqueNorm = [...new Set(codigosNorm)].filter(Boolean);
                            if (uniqueNorm.length > 0) {
                                try {
                                    const placeholders = uniqueNorm.map((_, i) => `$${i + 1}`).join(',');
                                    const sb1Result = await db.query(
                                        `SELECT TRIM(b1_cod) as b1_cod FROM sb1010
                                         WHERE TRIM(b1_cod) = ANY(ARRAY[${placeholders}])
                                           AND COALESCE(d_e_l_e_t_, '') = ''`,
                                        uniqueNorm
                                    );
                                    const found = new Set(sb1Result.rows.map(r => r.b1_cod.trim()));
                                    semMapeamento.forEach((orig, i) => {
                                        const norm = codigosNorm[i];
                                        if (norm && found.has(norm)) paiMapSB1[orig] = norm;
                                    });
                                } catch (sb1Err) {
                                    console.error('[VMI] Erro ao buscar pai no SB1:', sb1Err.message);
                                }
                            }
                        }

                        rows.forEach(row => {
                            if (!row.produto_pai) return;
                            row.b1_cod_pai = paiMapMySQL[row.produto_pai] || paiMapSB1[row.produto_pai] || null;
                        });
                    }
                    
                    // --- 5. Busca Pedido Metalfisa e Qtd Entregue no SC6 ---
                    const cleanString = (str) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toUpperCase();
                    const cleanOrderNumber = (str) => {
                        if (!str) return '';
                        let s = String(str).trim();
                        // Desconsidera o prefixo DMC-9800- globalmente
                        s = s.replace(/dmc-?9800-?/gi, '');
                        // Desconsidera as revisões/sufixos comuns
                        const revRegex = /([-/_.]|(\s+rev\b|\s+revis\w*))+/i;
                        const match = s.match(revRegex);
                        if (match && match.index !== undefined) {
                            s = s.substring(0, match.index);
                        }
                        return s.replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toUpperCase();
                    };
                    
                    const pedidosClienteArray = [...new Set(rows.map(r => cleanOrderNumber(r.ordem_compra_cliente)).filter(Boolean))];
                    const pedidosClienteLikeArray = pedidosClienteArray.map(p => `%${p}%`);
                    
                    if (pedidosClienteArray.length > 0 && b1Cods.length > 0) {
                        try {
                            const querySC6 = `
                                SELECT 
                                    LTRIM(UPPER(REGEXP_REPLACE(
                                        REGEXP_REPLACE(
                                            REGEXP_REPLACE(c6.c6_pedcli, 'dmc-?9800-?', '', 'gi'),
                                            '[-/_].*|\\s+rev.*|\\s+revis.*', '', 'i'
                                        ),
                                        '[^a-zA-Z0-9]', '', 'g'
                                    )), '0') AS pedcli,
                                    TRIM(c6.c6_produto) AS b1_cod,
                                    TRIM(c6.c6_num) AS c6_num,
                                    SUM(COALESCE(c6.c6_qtdven, 0)) AS qtd_pedido,
                                    SUM(COALESCE(c6.c6_qtdent, 0)) AS qtd_entregue
                                FROM public.sc6010 c6
                                WHERE c6.d_e_l_e_t_ = ''
                                  AND LTRIM(UPPER(REGEXP_REPLACE(
                                      REGEXP_REPLACE(
                                          REGEXP_REPLACE(c6.c6_pedcli, 'dmc-?9800-?', '', 'gi'),
                                          '[-/_].*|\\s+rev.*|\\s+revis.*', '', 'i'
                                      ),
                                      '[^a-zA-Z0-9]', '', 'g'
                                  )), '0') LIKE ANY($1::text[])
                                  AND TRIM(c6.c6_produto) = ANY($2::text[])
                                GROUP BY 1, TRIM(c6.c6_produto), TRIM(c6.c6_num)
                            `;
                            const sc6Result = await db.query(querySC6, [pedidosClienteLikeArray, b1Cods]);
                            
                            const orderNums = [...new Set(sc6Result.rows.map(r => r.c6_num).filter(Boolean))];
                            let nfsMap = {};
                            if (orderNums.length > 0) {
                                const querySD2 = `
                                    SELECT 
                                        TRIM(d2.d2_pedido) AS order_num,
                                        TRIM(d2.d2_cod) AS b1_cod,
                                        TRIM(d2.d2_doc) AS nota,
                                        TRIM(d2.d2_serie) AS serie,
                                        d2.d2_quant AS qtd,
                                        TO_CHAR(TO_DATE(NULLIF(TRIM(f2.f2_emissao), ''), 'YYYYMMDD'), 'DD/MM/YYYY') AS emissao,
                                        TRIM(d2.d2_cf) AS cfop
                                    FROM public.sd2010 d2
                                    JOIN public.sf2010 f2
                                      ON f2.f2_doc = d2.d2_doc 
                                     AND f2.f2_serie = d2.d2_serie
                                     AND COALESCE(f2.d_e_l_e_t_, '') = ''
                                    WHERE d2.d2_pedido = ANY($1::text[])
                                      AND TRIM(d2.d2_cod) = ANY($2::text[])
                                      AND COALESCE(d2.d_e_l_e_t_, '') = ''
                                `;
                                const sd2Result = await db.query(querySD2, [orderNums, b1Cods]);
                                sd2Result.rows.forEach(r => {
                                    const key = `${r.order_num}_${cleanString(r.b1_cod)}`;
                                    if (!nfsMap[key]) nfsMap[key] = [];
                                    nfsMap[key].push({
                                        nota: r.nota,
                                        serie: r.serie,
                                        qtd: Number(r.qtd),
                                        emissao: r.emissao,
                                        cfop: r.cfop
                                    });
                                });
                            }

                            const sc6Map = {};
                            sc6Result.rows.forEach(r => {
                                const key = `${cleanOrderNumber(r.pedcli)}_${cleanString(r.b1_cod)}`;
                                if (!sc6Map[key]) sc6Map[key] = [];
                                
                                const nfsKey = `${r.c6_num}_${cleanString(r.b1_cod)}`;
                                const nfs = nfsMap[nfsKey] || [];
                                
                                sc6Map[key].push({ 
                                    num: r.c6_num, 
                                    qtd: Number(r.qtd_entregue),
                                    qtdven: Number(r.qtd_pedido),
                                    notas_fiscais: nfs
                                });
                            });

                            rows.forEach(row => {
                                if (row.b1_cod) {
                                    const key = `${cleanOrderNumber(row.ordem_compra_cliente)}_${cleanString(row.b1_cod)}`;
                                    if (sc6Map[key] && sc6Map[key].length > 0) {
                                        row.pedido_metalfisa = sc6Map[key].map(x => x.num).join(' / ');
                                        row.qtd_pedido = sc6Map[key].reduce((sum, x) => sum + x.qtdven, 0);
                                        row.qtd_entregue = sc6Map[key].reduce((sum, x) => sum + x.qtd, 0);
                                        row.saldo_entregar = Math.max(0, row.qtd_pedido - row.qtd_entregue);
                                        
                                        const allNfs = [];
                                        sc6Map[key].forEach(x => {
                                            if (x.notas_fiscais) allNfs.push(...x.notas_fiscais);
                                        });
                                        row.notas_fiscais = allNfs;
                                    } else {
                                        row.pedido_metalfisa = '-';
                                        row.qtd_pedido = 0;
                                        row.qtd_entregue = 0;
                                        row.saldo_entregar = 0;
                                        row.notas_fiscais = [];
                                    }
                                } else {
                                    row.pedido_metalfisa = '-';
                                    row.qtd_pedido = 0;
                                    row.qtd_entregue = 0;
                                    row.saldo_entregar = 0;
                                    row.notas_fiscais = [];
                                }
                            });
                        } catch (errSC6) {
                            console.error('[VMI] Erro ao buscar SC6 (Pedido Metalfisa):', errSC6.message);
                        }
                    }
                }
            } catch (enrichErr) {
                console.error('Erro no enriquecimento Protheus/VMI:', enrichErr.message);
                // Não trava o retorno principal se o enriquecimento falhar
            }
        }

        res.json({
            data: rows,
            meta: { lote: loteSelecionado, total: rows.length }
        });
    } catch (err) {
        console.error('Erro ao buscar demandas VMI:', err);
        res.status(500).json({ error: 'Erro ao buscar demandas VMI' });
    }
});

// GET /api/vmi/pedidos-protheus
// Busca especificamente o Pedido Metalfisa e a Qtde Entregue do Protheus SC6
router.post('/pedidos-protheus', async (req, res) => {
    try {
        const { rows } = req.body;
        if (!rows || !rows.length) return res.json({ success: true, mappings: {} });

        const cleanString = (str) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toUpperCase();
        const cleanOrderNumber = (str) => {
            if (!str) return '';
            let s = String(str).trim();
            // Desconsidera o prefixo DMC-9800- globalmente
            s = s.replace(/dmc-?9800-?/gi, '');
            // Desconsidera as revisões/sufixos comuns
            const revRegex = /([-/_.]|(\s+rev\b|\s+revis\w*))+/i;
            const match = s.match(revRegex);
            if (match && match.index !== undefined) {
                s = s.substring(0, match.index);
            }
            return s.replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toUpperCase();
        };
        
        const pedidosClienteArray = [...new Set(rows.map(r => cleanOrderNumber(r.ordem_compra_cliente)).filter(Boolean))];
        const pedidosClienteLikeArray = pedidosClienteArray.map(p => `%${p}%`);
        const b1Cods = [...new Set(rows.map(r => String(r.b1_cod || '').trim()).filter(Boolean))];

        const sc6Map = {};
        
        if (pedidosClienteArray.length > 0 && b1Cods.length > 0) {
            const querySC6 = `
                SELECT 
                    LTRIM(UPPER(REGEXP_REPLACE(
                        REGEXP_REPLACE(
                            REGEXP_REPLACE(c6.c6_pedcli, 'dmc-?9800-?', '', 'gi'),
                            '[-/_].*|\\s+rev.*|\\s+revis.*', '', 'i'
                        ),
                        '[^a-zA-Z0-9]', '', 'g'
                    )), '0') AS pedcli,
                    TRIM(c6.c6_produto) AS b1_cod,
                    TRIM(c6.c6_num) AS c6_num,
                    SUM(COALESCE(c6.c6_qtdven, 0)) AS qtd_pedido,
                    SUM(COALESCE(c6.c6_qtdent, 0)) AS qtd_entregue
                FROM public.sc6010 c6
                WHERE c6.d_e_l_e_t_ = ''
                  AND LTRIM(UPPER(REGEXP_REPLACE(
                      REGEXP_REPLACE(
                          REGEXP_REPLACE(c6.c6_pedcli, 'dmc-?9800-?', '', 'gi'),
                          '[-/_].*|\\s+rev.*|\\s+revis.*', '', 'i'
                      ),
                      '[^a-zA-Z0-9]', '', 'g'
                  )), '0') LIKE ANY($1::text[])
                  AND TRIM(c6.c6_produto) = ANY($2::text[])
                GROUP BY 1, TRIM(c6.c6_produto), TRIM(c6.c6_num)
            `;
            const sc6Result = await db.query(querySC6, [pedidosClienteLikeArray, b1Cods]);
            
            const orderNums = [...new Set(sc6Result.rows.map(r => r.c6_num).filter(Boolean))];
            let nfsMap = {};
            if (orderNums.length > 0) {
                const querySD2 = `
                    SELECT 
                        TRIM(d2.d2_pedido) AS order_num,
                        TRIM(d2.d2_cod) AS b1_cod,
                        TRIM(d2.d2_doc) AS nota,
                        TRIM(d2.d2_serie) AS serie,
                        d2.d2_quant AS qtd,
                        TO_CHAR(TO_DATE(NULLIF(TRIM(f2.f2_emissao), ''), 'YYYYMMDD'), 'DD/MM/YYYY') AS emissao,
                        TRIM(d2.d2_cf) AS cfop
                    FROM public.sd2010 d2
                    JOIN public.sf2010 f2
                      ON f2.f2_doc = d2.d2_doc 
                     AND f2.f2_serie = d2.d2_serie
                     AND COALESCE(f2.d_e_l_e_t_, '') = ''
                    WHERE d2.d2_pedido = ANY($1::text[])
                      AND TRIM(d2.d2_cod) = ANY($2::text[])
                      AND COALESCE(d2.d_e_l_e_t_, '') = ''
                `;
                const sd2Result = await db.query(querySD2, [orderNums, b1Cods]);
                sd2Result.rows.forEach(r => {
                    const key = `${r.order_num}_${cleanString(r.b1_cod)}`;
                    if (!nfsMap[key]) nfsMap[key] = [];
                    nfsMap[key].push({
                        nota: r.nota,
                        serie: r.serie,
                        qtd: Number(r.qtd),
                        emissao: r.emissao,
                        cfop: r.cfop
                    });
                });
            }

            sc6Result.rows.forEach(r => {
                const key = `${cleanOrderNumber(r.pedcli)}_${cleanString(r.b1_cod)}`;
                if (!sc6Map[key]) sc6Map[key] = [];
                
                const nfsKey = `${r.c6_num}_${cleanString(r.b1_cod)}`;
                const nfs = nfsMap[nfsKey] || [];
                
                sc6Map[key].push({ 
                    num: r.c6_num, 
                    qtd: Number(r.qtd_entregue),
                    qtdven: Number(r.qtd_pedido),
                    notas_fiscais: nfs
                });
            });
        }

        res.json({ success: true, mappings: sc6Map });
    } catch (err) {
        console.error('Erro ao buscar pedidos Protheus (SC6):', err);
        res.status(500).json({ error: 'Erro ao buscar SC6' });
    }
});

// DELETE /api/vmi/lotes/:loteId — remove um lote específico
router.delete('/lotes/:loteId', async (req, res) => {
    try {
        const { loteId } = req.params;
        await mysqlPool.execute('DELETE FROM app_demanda_vmi WHERE lote_importacao = ?', [loteId]);
        await mysqlPool.execute('DELETE FROM app_demanda_vmi_lotes WHERE lote_id = ?', [loteId]);
        res.json({ success: true, msg: 'Lote removido com sucesso.' });
    } catch (err) {
        console.error('Erro ao remover lote:', err);
        res.status(500).json({ error: 'Erro ao remover lote.' });
    }
});

// DELETE /api/vmi/all
// Reseta a base de demandas (Truncate behavior)
router.delete('/all', async (req, res) => {
    try {
        await mysqlPool.execute('DELETE FROM app_demanda_vmi WHERE id > 0');
        await mysqlPool.execute('DELETE FROM app_demanda_vmi_lotes WHERE id > 0');
        res.json({ success: true, msg: 'As importações antigas foram limpas com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao limpar dados.' });
    }
});

// GET /api/vmi/lotes
// Lista todos os lotes importados com metadados completos
router.get('/lotes', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT
                lote_id, nome_arquivo, sheet_name,
                total_linhas, total_produtos, total_pedidos, total_quantidade,
                meses_referencia, usuario_nome, created_at
            FROM app_demanda_vmi_lotes
            ORDER BY created_at DESC
            LIMIT 100
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Erro ao listar lotes VMI:', err);
        res.status(500).json({ error: 'Erro ao listar lotes' });
    }
});

// ── GET /api/vmi/mapeamento/atual ──
// Retorna todos os mapeamentos já salvos na tabela app_demanda_vmi_map
router.get('/mapeamento/atual', async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute('SELECT * FROM app_demanda_vmi_map');
        const b1Cods = [...new Set(rows.map(r => r.b1_cod).filter(Boolean))];
        
        const pdfMap = {};
        const statusMap = {};

        if (b1Cods.length > 0) {
            // 1. Busca PDFs
            try {
                const placeholders = b1Cods.map(() => '?').join(',');
                const [pdfRows] = await mysqlPool.query(
                    `SELECT produto_codigo, MIN(url_arquivo) AS url FROM produtos_docs WHERE produto_codigo IN (${placeholders}) GROUP BY produto_codigo`,
                    b1Cods
                );
                pdfRows.forEach(r => { pdfMap[r.produto_codigo] = r.url; });
            } catch (_) {}

            // 2. Busca Status no Postgres (Protheus)
            try {
                const queryStatus = `
                    SELECT 
                        TRIM(sb1.b1_cod) as b1_cod,
                        CASE
                            WHEN sb1.b1_msblql IN ('1','S','T','Y') OR EXISTS (SELECT 1 FROM public.sz0010 sz0 WHERE TRIM(sz0.z0_produto) = TRIM(sb1.b1_cod) AND sz0.z0_status = 'P' AND COALESCE(sz0.d_e_l_e_t_, '') = '') THEN 'Restrição'
                            WHEN NOT EXISTS (SELECT 1 FROM public.sg1010 sg1 WHERE TRIM(sg1.g1_cod) = TRIM(sb1.b1_cod) AND COALESCE(sg1.d_e_l_e_t_, '') = '')
                             AND NOT EXISTS (SELECT 1 FROM public.sg2010 sg2 WHERE TRIM(sg2.g2_produto) = TRIM(sb1.b1_cod) AND COALESCE(sg2.d_e_l_e_t_, '') = '') THEN 'Novo'
                            ELSE 'PCP'
                        END as status_tipo_item,
                        CASE
                            WHEN sb1.b1_msblql IN ('1','S','T','Y') THEN 'Produto bloqueado no cadastro (SB1 b1_msblql).'
                            WHEN EXISTS (SELECT 1 FROM public.sz0010 sz0 WHERE TRIM(sz0.z0_produto) = TRIM(sb1.b1_cod) AND sz0.z0_status = 'P' AND COALESCE(sz0.d_e_l_e_t_, '') = '') THEN 'Restrição pendente no cadastro (SZ0 status=P).'
                            WHEN NOT EXISTS (SELECT 1 FROM public.sg1010 sg1 WHERE TRIM(sg1.g1_cod) = TRIM(sb1.b1_cod) AND COALESCE(sg1.d_e_l_e_t_, '') = '')
                             AND NOT EXISTS (SELECT 1 FROM public.sg2010 sg2 WHERE TRIM(sg2.g2_produto) = TRIM(sb1.b1_cod) AND COALESCE(sg2.d_e_l_e_t_, '') = '') THEN 'Produto novo — sem estrutura.'
                            ELSE 'Liberado.'
                        END as status_tipo_detalhe
                    FROM public.sb1010 sb1
                    WHERE TRIM(sb1.b1_cod) IN (${b1Cods.map((_, i) => `$${i + 1}`).join(',')})
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                `;
                const pgResult = await db.query(queryStatus, b1Cods);
                pgResult.rows.forEach(r => { statusMap[r.b1_cod] = r; });
            } catch (e) {
                console.error('Erro ao buscar status no mapeamento:', e.message);
            }
        }

        const data = rows.map(r => ({
            ...r,
            pdf_url: pdfMap[r.b1_cod] || null,
            z1_revisao: r.z1_revisao || null,
            status_tipo_item: statusMap[r.b1_cod]?.status_tipo_item || (r.b1_cod ? 'PCP' : null),
            status_tipo_detalhe: statusMap[r.b1_cod]?.status_tipo_detalhe || (r.b1_cod ? 'Liberado.' : null)
        }));

        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar mapeamentos.' });
    }
});

// ── POST /api/vmi/mapeamento/sugerir ──
// Recebe array de codigos_cliente, puxa sugestões do Protheus em paralelo.
router.post('/mapeamento/sugerir', async (req, res) => {
    try {
        const { codigos } = req.body;
        if (!Array.isArray(codigos)) return res.status(400).json({ error: 'Array de códigos inválido.' });

        // Query extendida com status
        const wrapWithStatus = (innerQuery) => `
            SELECT 
                t.*,
                CASE
                    WHEN sb1_ref.b1_msblql IN ('1','S','T','Y') OR EXISTS (SELECT 1 FROM public.sz0010 sz0 WHERE TRIM(sz0.z0_produto) = TRIM(t.b1_cod) AND sz0.z0_status = 'P' AND COALESCE(sz0.d_e_l_e_t_, '') = '') THEN 'Restrição'
                    WHEN NOT EXISTS (SELECT 1 FROM public.sg1010 sg1 WHERE TRIM(sg1.g1_cod) = TRIM(t.b1_cod) AND COALESCE(sg1.d_e_l_e_t_, '') = '')
                     AND NOT EXISTS (SELECT 1 FROM public.sg2010 sg2 WHERE TRIM(sg2.g2_produto) = TRIM(t.b1_cod) AND COALESCE(sg2.d_e_l_e_t_, '') = '') THEN 'Novo'
                    ELSE 'PCP'
                END as status_tipo_item,
                CASE
                    WHEN sb1_ref.b1_msblql IN ('1','S','T','Y') THEN 'Produto bloqueado.'
                    WHEN EXISTS (SELECT 1 FROM public.sz0010 sz0 WHERE TRIM(sz0.z0_produto) = TRIM(t.b1_cod) AND sz0.z0_status = 'P' AND COALESCE(sz0.d_e_l_e_t_, '') = '') THEN 'Restrição pendente.'
                    WHEN NOT EXISTS (SELECT 1 FROM public.sg1010 sg1 WHERE TRIM(sg1.g1_cod) = TRIM(t.b1_cod) AND COALESCE(sg1.d_e_l_e_t_, '') = '')
                     AND NOT EXISTS (SELECT 1 FROM public.sg2010 sg2 WHERE TRIM(sg2.g2_produto) = TRIM(t.b1_cod) AND COALESCE(sg2.d_e_l_e_t_, '') = '') THEN 'Sem estrutura.'
                    ELSE 'Liberado.'
                END as status_tipo_detalhe
            FROM (${innerQuery}) t
            JOIN public.sb1010 sb1_ref ON TRIM(sb1_ref.b1_cod) = t.b1_cod AND COALESCE(sb1_ref.d_e_l_e_t_, '') = ''
        `;

        const querySZ1 = wrapWithStatus(`
            SELECT DISTINCT
                TRIM(sz1.z1_produto) AS b1_cod,
                TRIM(sb1.b1_desc)    AS b1_desc,
                TRIM(sz1.z1_revisao) AS z1_revisao,
                CASE
                    WHEN regexp_replace(trim(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g') ILIKE $1
                         AND ($2::text IS NULL OR upper(TRIM(sz1.z1_revisao)) = upper($2)) THEN 5
                    WHEN regexp_replace(trim(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g') ILIKE $1 THEN 4
                    WHEN ($2::text IS NOT NULL AND upper(TRIM(sz1.z1_revisao)) = upper($2)) THEN 3
                    ELSE 2
                END AS score
            FROM public.sz1010 sz1
            JOIN public.sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sz1.z1_produto)
              AND COALESCE(sb1.d_e_l_e_t_, '') <> '*'
            WHERE regexp_replace(trim(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g') ILIKE '%' || $1 || '%'
              AND COALESCE(sz1.d_e_l_e_t_, '') <> '*'
              AND TRIM(sz1.z1_produto) <> ''
            LIMIT 10
        `);

        const EXCLUDED_PREFIXES = 'MTC|SCL|MTI|MTA|MT8|MMP|MT7|MT1|MTB|COM';
        const queryB1 = wrapWithStatus(`
            SELECT
                TRIM(sb1.b1_cod)  AS b1_cod,
                TRIM(sb1.b1_desc) AS b1_desc,
                CASE
                    WHEN upper(left(regexp_replace(trim(sb1.b1_cod), '[^a-zA-Z0-9]', '', 'g'), 9)) = upper($1) THEN 3
                    WHEN upper(left(regexp_replace(trim(sb1.b1_cod), '[^a-zA-Z0-9]', '', 'g'), 9)) ILIKE upper($1) || '%' THEN 2
                    ELSE 1
                END AS score
            FROM public.sb1010 sb1
            WHERE left(regexp_replace(trim(sb1.b1_cod), '[^a-zA-Z0-9]', '', 'g'), 9) ILIKE '%' || $1 || '%'
              AND COALESCE(sb1.d_e_l_e_t_, '') <> '*'
              AND trim(sb1.b1_cod) <> ''
              AND trim(sb1.b1_cod) !~* '${EXCLUDED_PREFIXES}'
            LIMIT 10
        `);

        // Separa códigos válidos
        const validCodigos = codigos.filter(cod =>
            cod && cod !== 'null' && cod !== 'undefined' &&
            cod.replace(/[^a-zA-Z0-9]/g, '').length >= 3
        );

        const resultados = await Promise.all(
            validCodigos.map(async (cod) => {
                const baseCode = cod.replace(/[^a-zA-Z0-9]/g, '');
                const searchCode = baseCode.length > 9 ? baseCode.substring(0, 9) : baseCode;
                const revCode = baseCode.length > 9 ? baseCode.substring(9) : null;
                try {
                    const sz1Result = await db.query(querySZ1, [searchCode, revCode]);
                    if (sz1Result.rows.length > 0) {
                        return { cod, baseCode: searchCode, revCode, rows: sz1Result.rows, fonte: 'sz1' };
                    }
                    const b1Result = await db.query(queryB1, [searchCode]);
                    return { cod, baseCode: searchCode, revCode, rows: b1Result.rows, fonte: 'b1' };
                } catch (e) {
                    console.error(`Erro query sugestão para "${cod}":`, e.message);
                    return { cod, baseCode: searchCode, revCode, rows: [], fonte: 'erro' };
                }
            })
        );

        const sugestoes = {};
        const bases = {};
        for (const cod of codigos) {
            if (!validCodigos.includes(cod)) { sugestoes[cod] = []; bases[cod] = { searchCode: '', revCode: null }; }
        }
        for (const { cod, baseCode, revCode, rows } of resultados) {
            sugestoes[cod] = rows.sort((a, b) => b.score - a.score);
            bases[cod] = { searchCode: baseCode, revCode: revCode || null };
        }

        // Busca PDF URLs
        const allB1Cods = [...new Set(Object.values(sugestoes).flat().map(s => s.b1_cod).filter(Boolean))];
        const pdfMap = {};
        if (allB1Cods.length > 0) {
            try {
                const placeholders = allB1Cods.map(() => '?').join(',');
                const [pdfRows] = await mysqlPool.query(
                    `SELECT produto_codigo, MIN(url_arquivo) AS url FROM produtos_docs WHERE produto_codigo IN (${placeholders}) GROUP BY produto_codigo`,
                    allB1Cods
                );
                pdfRows.forEach(r => { pdfMap[r.produto_codigo] = r.url; });
            } catch (_) {}
        }
        for (const cod of Object.keys(sugestoes)) {
            sugestoes[cod] = sugestoes[cod].map(s => ({ ...s, pdf_url: pdfMap[s.b1_cod] || null }));
        }

        res.json({ success: true, sugestoes, bases });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao processar sugestões no Protheus.' });
    }
});

// ── POST /api/vmi/mapeamento/confirmar ──
// Salva o vínculo cliente x protheus na base MySQL
router.post('/mapeamento/confirmar', async (req, res) => {
    try {
        const { codigo_cliente, b1_cod, descricao_protheus, z1_revisao } = req.body;
        if (!codigo_cliente || !b1_cod) return res.status(400).json({ error: 'Dados insuficientes.' });

        const query = `
            INSERT INTO app_demanda_vmi_map (codigo_produto_cliente, b1_cod, descricao_protheus, z1_revisao)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE b1_cod = VALUES(b1_cod), descricao_protheus = VALUES(descricao_protheus), z1_revisao = VALUES(z1_revisao)
        `;

        await mysqlPool.execute(query, [codigo_cliente, b1_cod, descricao_protheus || null, z1_revisao || null]);
        res.json({ success: true, msg: 'Vínculo salvo com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar vínculo.' });
    }
});

// ── POST /api/vmi/mapeamento/confirmar-lote ──
// Salva múltiplos vínculos de uma vez (array de { codigo_cliente, b1_cod, descricao_protheus, z1_revisao })
router.post('/mapeamento/confirmar-lote', async (req, res) => {
    try {
        const { vinculos } = req.body;
        if (!Array.isArray(vinculos) || vinculos.length === 0)
            return res.status(400).json({ error: 'Array de vínculos inválido.' });

        const query = `
            INSERT INTO app_demanda_vmi_map (codigo_produto_cliente, b1_cod, descricao_protheus, z1_revisao)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE b1_cod = VALUES(b1_cod), descricao_protheus = VALUES(descricao_protheus), z1_revisao = VALUES(z1_revisao)
        `;

        let salvos = 0;
        const erros = [];
        for (const v of vinculos) {
            if (!v.codigo_cliente || !v.b1_cod) continue;
            try {
                await mysqlPool.execute(query, [v.codigo_cliente, v.b1_cod, v.descricao_protheus || null, v.z1_revisao || null]);
                salvos++;
            } catch (e) {
                erros.push(v.codigo_cliente);
            }
        }

        res.json({ success: true, salvos, erros });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar vínculos em lote.' });
    }
});

// ── DELETE /api/vmi/mapeamento/:codigo_cliente ──
// Remove um vínculo específico
router.delete('/mapeamento/:codigo_cliente', async (req, res) => {
    try {
        const { codigo_cliente } = req.params;
        await mysqlPool.query(
            'DELETE FROM app_demanda_vmi_map WHERE codigo_produto_cliente = ?',
            [codigo_cliente]
        );
        res.json({ success: true, msg: 'Vínculo removido.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao remover vínculo.' });
    }
});

// ── POST /api/vmi/mapeamento/desvincular-lote ──
// Remove múltiplos vínculos de uma vez
router.post('/mapeamento/desvincular-lote', async (req, res) => {
    try {
        const { codigos } = req.body;
        if (!Array.isArray(codigos) || codigos.length === 0) {
            return res.status(400).json({ error: 'Nenhum código fornecido.' });
        }
        
        const placeholders = codigos.map(() => '?').join(',');
        await mysqlPool.query(
            `DELETE FROM app_demanda_vmi_map WHERE codigo_produto_cliente IN (${placeholders})`,
            codigos
        );
        
        res.json({ success: true, removidos: codigos.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao remover vínculos.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vmi/op-mirror/:b1cod?qty=1&sheet=NomePlanilha&data=DD/MM/AAAA
// Espelho de OP por código de produto (b1_cod). Mesmo formato que /api/pedidos/op-mirror/:id.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/op-mirror/:b1cod', async (req, res) => {
    try {
        const { b1cod } = req.params;
        const qty   = parseFloat(req.query.qty)   || 1;
        const sheet = req.query.sheet || '';
        const data  = req.query.data  || new Date().toLocaleDateString('pt-BR');

        // Busca info do produto no SB1 (sem filtro de delete para não bloquear produtos inativos)
        const prodResult = await db.query(
            `SELECT TRIM(b1_cod) AS codigo, TRIM(b1_desc) AS descricao, TRIM(b1_um) AS unidade, TRIM(b1_urev) AS revisao
             FROM sb1010
             WHERE TRIM(b1_cod) = $1
             ORDER BY COALESCE(d_e_l_e_t_, '') ASC
             LIMIT 1`,
            [b1cod.trim()]
        );

        // Se não encontrou no SB1, usa o próprio b1cod como fallback e tenta explodir a BOM mesmo assim
        const prod = prodResult.rows.length > 0
            ? prodResult.rows[0]
            : { codigo: b1cod.trim(), descricao: b1cod.trim(), unidade: 'UN', revisao: '' };

        const explosionQuery = `
            WITH RECURSIVE estrutura AS (
                SELECT
                    '01'::varchar        AS item_pedido,
                    0                    AS nivel,
                    $1::varchar          AS produto_pai,
                    $1::varchar          AS componente,
                    $3::varchar          AS descricao,
                    $4::varchar          AS unidade,
                    $5::varchar          AS revisao,
                    1::numeric           AS qtd_base,
                    $2::numeric          AS qtd_necessaria,
                    ''::varchar          AS op_relacionada
                UNION ALL
                SELECT
                    e.item_pedido,
                    e.nivel + 1,
                    CAST(TRIM(e.componente) AS VARCHAR(30)) AS produto_pai,
                    CAST(TRIM(g1.g1_comp)   AS VARCHAR(30)) AS componente,
                    CAST(TRIM(sb1.b1_desc)  AS VARCHAR(100)) AS descricao,
                    CAST(TRIM(sb1.b1_um)    AS VARCHAR(10))  AS unidade,
                    CAST(TRIM(sb1.b1_urev)  AS VARCHAR(10))  AS revisao,
                    g1.g1_quant::numeric AS qtd_base,
                    (e.qtd_necessaria * g1.g1_quant::numeric)::numeric AS qtd_necessaria,
                    ''::varchar AS op_relacionada
                FROM estrutura e
                JOIN sg1010 g1
                    ON TRIM(g1.g1_cod) = TRIM(e.componente)
                   AND COALESCE(g1.d_e_l_e_t_, '') = ''
                LEFT JOIN sb1010 sb1
                    ON TRIM(sb1.b1_cod) = TRIM(g1.g1_comp)
                   AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE e.nivel < 15
            )
            SELECT
                e.item_pedido,
                e.nivel,
                e.produto_pai,
                e.componente,
                e.descricao,
                e.unidade,
                e.revisao,
                e.qtd_necessaria,
                e.op_relacionada,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'seq',          TRIM(g2.g2_operac),
                                'recurso',      TRIM(g2.g2_recurso),
                                'desc_operacao', CASE
                                    WHEN TRIM(g2.g2_recurso) = 'MO0013' THEN 'LASE'
                                    ELSE TRIM(h1.h1_descri)
                                END,
                                'setup',          g2.g2_setup,
                                'tempo_padrao',   ROUND(g2.g2_tempad::numeric, 3),
                                'ferramenta',     TRIM(g2.g2_ferram)
                            ) ORDER BY TRIM(g2.g2_operac)
                        )
                        FROM sg2010 g2
                        LEFT JOIN sh1010 h1
                            ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
                           AND COALESCE(h1.d_e_l_e_t_, '') = ''
                        WHERE TRIM(g2.g2_produto) = CAST(TRIM(e.componente) AS VARCHAR(30))
                          AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                    ), '[]'::json
                ) AS operacoes
            FROM estrutura e
            ORDER BY e.nivel ASC, e.produto_pai ASC, e.componente ASC
        `;

        const explosionResult = await db.query(explosionQuery, [
            prod.codigo, qty, prod.descricao, prod.unidade, prod.revisao
        ]);

        // Monta estrutura idêntica ao /op-mirror/:id
        const itemGroup = {
            item_pedido: '01',
            produto_principal: null,
            estrutura_linear: []
        };

        explosionResult.rows.forEach(row => {
            if (row.nivel === 0) {
                itemGroup.produto_principal = {
                    codigo:           row.componente,
                    descricao:        row.descricao,
                    revisao:          row.revisao,
                    unidade:          row.unidade,
                    quantidade_venda: parseFloat(row.qtd_necessaria),
                    op_num:           row.op_relacionada || '-',
                    operacoes:        row.operacoes
                };
            } else {
                itemGroup.estrutura_linear.push({
                    nivel:                parseInt(row.nivel),
                    pai:                  row.produto_pai,
                    codigo:               row.componente,
                    descricao:            row.descricao,
                    unidade:              row.unidade,
                    quantidade_calculada: parseFloat(row.qtd_necessaria),
                    op_num:               row.op_relacionada || '-',
                    operacoes:            row.operacoes
                });
            }
        });

        res.json({
            pedido: {
                pedido:      prod.codigo,
                emissao:     data,
                nome_cliente: sheet || prod.descricao,
                cgc_cliente:  '',
                municipio:    '',
                estado:       ''
            },
            itens: [itemGroup]
        });

    } catch (err) {
        console.error('[VMI OP Mirror Error]', err);
        res.status(500).json({ error: 'Erro ao gerar espelho de OP', details: err.message });
    }
});

module.exports = router;
