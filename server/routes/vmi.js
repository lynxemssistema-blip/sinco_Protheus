const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const multer = require('multer');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');
const { hasFinancialAccess } = require('../util/permissionHelper');

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

    // ── OC's de Fornecedores ─────────────────────────────────────────────────
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS app_vmi_oc_lotes (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            lote_id         VARCHAR(36)  NOT NULL UNIQUE,
            nome_arquivo    VARCHAR(255) DEFAULT NULL,
            hash_conteudo   VARCHAR(64)  DEFAULT NULL,
            total_linhas    INT          DEFAULT 0,
            total_produtos  INT          DEFAULT 0,
            total_ocs       INT          DEFAULT 0,
            qtde_total      DECIMAL(15,4) DEFAULT 0,
            custo_total     DECIMAL(15,2) DEFAULT 0,
            usuario_id      INT          DEFAULT NULL,
            usuario_nome    VARCHAR(150) DEFAULT NULL,
            created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_lote (lote_id),
            INDEX idx_data (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS app_vmi_oc_itens (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            lote_id         VARCHAR(36)   NOT NULL,
            oc              VARCHAR(20)   DEFAULT NULL,
            item_oc         VARCHAR(10)   DEFAULT NULL,
            produto         VARCHAR(80)   DEFAULT NULL,
            produto_clean   VARCHAR(80)   DEFAULT NULL,
            desc_produto    TEXT          DEFAULT NULL,
            nome_fornecedor VARCHAR(255)  DEFAULT NULL,
            dt_emissao      DATE          DEFAULT NULL,
            dt_neg          DATE          DEFAULT NULL,
            responsavel     VARCHAR(100)  DEFAULT NULL,
            qtde_em_aberto  DECIMAL(12,4) DEFAULT 0,
            custo_uni       DECIMAL(14,6) DEFAULT 0,
            custo_total     DECIMAL(12,2) DEFAULT 0,
            situacao        VARCHAR(20)   DEFAULT NULL,
            arm             VARCHAR(10)   DEFAULT NULL,
            b1_cod          VARCHAR(80)   DEFAULT NULL,
            INDEX idx_lote    (lote_id),
            INDEX idx_produto (produto(60)),
            INDEX idx_b1cod   (b1_cod(60)),
            INDEX idx_oc      (oc)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

initTables().catch(err => console.error('❌ VMI table init error:', err.message));


// Migração incremental: adiciona colunas novas à tabela de cache se ainda não existirem
(async () => {
    const alters = [
        `ALTER TABLE app_demanda_vmi_pedidos_cache ADD COLUMN item_pedido VARCHAR(50) DEFAULT '' AFTER pedido_metalfisa`,
        `ALTER TABLE app_demanda_vmi_pedidos_cache ADD COLUMN ops_relacionadas MEDIUMTEXT DEFAULT NULL`,
        `ALTER TABLE app_demanda_vmi_pedidos_cache ADD COLUMN data_entrega_comercial VARCHAR(8) DEFAULT '' AFTER ops_relacionadas`,
        `ALTER TABLE app_demanda_vmi_pedidos_cache ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
        `CREATE UNIQUE INDEX uq_vmi_cache_oc_prod ON app_demanda_vmi_pedidos_cache (ordem_compra_cliente(100), codigo_produto_cliente(100))`
    ];
    for (const sql of alters) {
        try { await mysqlPool.query(sql); } catch (_) { /* ignora se coluna/índice já existe */ }
    }
})();

// Migração incremental: adiciona custo_protheus à tabela de itens OC
(async () => {
    const alters = [
        `ALTER TABLE app_vmi_oc_itens ADD COLUMN custo_protheus DECIMAL(14,6) DEFAULT NULL AFTER b1_cod`,
    ];
    for (const sql of alters) {
        try { await mysqlPool.query(sql); } catch (_) { /* ignora se já existe */ }
    }
})();

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
                v.id, v.lote_importacao, v.prioridade_cliente, v.ordem_compra_cliente, v.produto_pai,
                v.descricao_equipamento, v.codigo_produto_cliente, v.descricao_produto_cliente,
                v.rev_cliente, v.mes_referencia, v.quantidade, v.created_at,
                d.data_original, d.data_revisada,
                pc.pedido_metalfisa, pc.item_pedido, pc.data_criacao_metalfisa, pc.data_entrega_metalfisa,
                pc.qtd_pedido, pc.qtd_entregue, pc.saldo_entregar, pc.notas_fiscais, pc.ops_relacionadas,
                pc.data_entrega_comercial,
                fpd.data_entrega_pcp, fpd.data_prevista_faturamento
            FROM app_demanda_vmi v
            LEFT JOIN app_demanda_vmi_datas d
              ON d.ordem_compra_cliente = v.ordem_compra_cliente
             AND d.codigo_produto_cliente = v.codigo_produto_cliente
            LEFT JOIN app_demanda_vmi_pedidos_cache pc
              ON pc.ordem_compra_cliente = v.ordem_compra_cliente
             AND pc.codigo_produto_cliente = v.codigo_produto_cliente
            LEFT JOIN (
                SELECT TRIM(pedido) COLLATE utf8mb4_general_ci AS pedido,
                       TRIM(item)   COLLATE utf8mb4_general_ci AS item,
                    MIN(data_entrega_pcp) AS data_entrega_pcp,
                    MAX(data_prevista_faturamento) AS data_prevista_faturamento
                FROM app_pcp_delivery_forecasts
                WHERE pedido IS NOT NULL AND item IS NOT NULL
                GROUP BY TRIM(pedido) COLLATE utf8mb4_general_ci, TRIM(item) COLLATE utf8mb4_general_ci
            ) fpd ON fpd.pedido = TRIM(SUBSTRING_INDEX(IFNULL(pc.pedido_metalfisa,''), ' / ', 1))
                 AND fpd.item   = TRIM(SUBSTRING_INDEX(IFNULL(pc.item_pedido,''),      ' / ', 1))
            WHERE v.lote_importacao = ?
            ORDER BY v.ordem_compra_cliente ASC, v.codigo_produto_cliente ASC, v.mes_referencia ASC
        `, [loteSelecionado]);

        // Parse JSON fields stored as text in MySQL cache
        rows.forEach(r => {
            if (r.notas_fiscais != null) {
                if (typeof r.notas_fiscais === 'string') {
                    try { r.notas_fiscais = JSON.parse(r.notas_fiscais); } catch { r.notas_fiscais = []; }
                }
                if (!Array.isArray(r.notas_fiscais)) r.notas_fiscais = [];
            } else {
                r.notas_fiscais = [];
            }
            if (r.ops_relacionadas != null) {
                if (typeof r.ops_relacionadas === 'string') {
                    try { r.ops_relacionadas = JSON.parse(r.ops_relacionadas); } catch { r.ops_relacionadas = []; }
                }
                if (!Array.isArray(r.ops_relacionadas)) r.ops_relacionadas = [];
            } else {
                r.ops_relacionadas = [];
            }
        });

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
                                // Auto-match via SZ1: z1_codcli (código do cliente) → z1_produto (b1_cod Protheus)
                                const autoMatchQuery = `
                                    SELECT DISTINCT
                                        UPPER(REGEXP_REPLACE(TRIM(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g')) AS clean_codcli,
                                        TRIM(sz1.z1_produto) AS b1_cod
                                    FROM public.sz1010 sz1
                                    WHERE UPPER(REGEXP_REPLACE(TRIM(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g')) = ANY($1::text[])
                                    AND COALESCE(sz1.d_e_l_e_t_, '') = ''
                                    AND TRIM(sz1.z1_produto) <> ''
                                `;
                                const autoMatchResult = await db.query(autoMatchQuery, [cleanCodes]);
                                autoMatchResult.rows.forEach(r => {
                                    const orig = cleanToOriginal[r.clean_codcli];
                                    if (orig) mapeamentoMap[orig] = r.b1_cod;
                                });
                            } catch (errAuto) {
                                console.error('Erro no auto-match via SZ1:', errAuto.message);
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
LESCE(sg2.d_e_l_e_t_, '') = '') THEN 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.'
                                    ELSE 'Item liberado para PCP.'
                                END as status_tipo_detalhe_base
                            FROM public.sb1010 sb1
                            WHERE TRIM(sb1.b1_cod) IN (${b1Cods.map((_, i) => `$${i + 1}`).join(',')})
                            AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                        `;

                        const pgResult = await db.query(queryStatus, b1Cods);
                        const statusMap = {};
                        pgResult.rows.forEach(r => { statusMap[r.b1_cod] = r; });

                        // 2.5 Busca PDFs via produtos_docs — mesma tabela e lógica da página /produtos
                        const pdfMap = {};
                        try {
                            const [pdfRows] = await mysqlPool.execute(
                                `SELECT produto_codigo, url_arquivo
                                 FROM produtos_docs
                                 WHERE produto_codigo IN (${b1Cods.map(() => '?').join(',')})
                                 ORDER BY CASE WHEN tipo = 'Desenho' THEN 0 ELSE 1 END, created_at DESC`,
                                b1Cods
                            );
                            // Pega somente o primeiro resultado por produto (Desenho priorizado)
                            pdfRows.forEach(r => {
                                const key = String(r.produto_codigo).trim();
                                if (!pdfMap[key]) pdfMap[key] = r.url_arquivo;
                            });
                        } catch (pdfErr) {
                            console.warn('[VMI] Aviso: não foi possível buscar PDFs em produtos_docs:', pdfErr.message);
                        }

                        // 3. Mescla os dados diretamente em rows (mutação in-place)
                        rows.forEach(r => {
                            if (r.notas_fiscais) {
                                try { r.notas_fiscais = typeof r.notas_fiscais === 'string' ? JSON.parse(r.notas_fiscais) : r.notas_fiscais; }
                                catch (e) { r.notas_fiscais = []; }
                            }
                            if (r.ops_relacionadas) {
                                try { r.ops_relacionadas = typeof r.ops_relacionadas === 'string' ? JSON.parse(r.ops_relacionadas) : r.ops_relacionadas; }
                                catch (e) { r.ops_relacionadas = []; }
                            }

                            const b1Cod = mapeamentoMap[r.codigo_produto_cliente];
                            if (b1Cod && statusMap[b1Cod]) {
                                const s = statusMap[b1Cod];

                                // Lógica de Revisão: Compara rev_cliente com rev_protheus (SZ1)
                                const revsProtheus = (s.rev_protheus || '').split(' / ').map(v => v.trim());
                                const revVmi = (r.rev_cliente || '').trim();
                                let stItem = s.status_tipo_item_base;
                                let stDetalhe = s.status_tipo_detalhe_base;

                                if (revVmi && revsProtheus.length > 0 && !revsProtheus.includes(revVmi)) {
                                    stItem = 'Revisão';
                                    stDetalhe = `Diferença de revisão. VMI: ${revVmi} / Protheus: ${s.rev_protheus}`;
                                }

                                r.b1_cod = b1Cod;
                                r.b1_desc = s.b1_desc;
                                r.pdf_url = pdfMap[String(b1Cod).trim()] || null;
                                r.status_tipo_item = stItem;
                                r.status_tipo_detalhe = stDetalhe;
                            } else if (b1Cod) {
                                r.b1_cod = b1Cod;
                                r.status_tipo_item = 'Restrição';
                                r.status_tipo_detalhe = 'Produto mapeado não encontrado no Protheus (SB1).';
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
        
        const cleanCliente = (str) => {
            let s = String(str || '');
            const revMatch = s.match(/(-[A-Za-z0-9]+|\s+REV.*)$/i);
            if (revMatch) s = s.substring(0, revMatch.index);
            return s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        };

        const pedidosClienteArray = [...new Set(rows.map(r => cleanOrderNumber(r.ordem_compra_cliente)).filter(Boolean))];
        const pedidosClienteLikeArray = pedidosClienteArray.map(p => `%${p}%`);
        let b1Cods = [...new Set(rows.map(r => String(r.b1_cod || '').trim()).filter(Boolean))];
        const codigosClienteArray = [...new Set(rows.map(r => cleanCliente(r.codigo_produto_cliente)).filter(Boolean))];

        const sc6Map = {};
        let pgSync = null;

        if (pedidosClienteArray.length > 0) {
            pgSync = await db.connect();
            try { await pgSync.query("SET statement_timeout = '240000'"); } catch (_) {}

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
                    MIN(TRIM(c6.c6_item)) AS c6_item,
                    SUM(COALESCE(c6.c6_qtdven, 0)) AS qtd_pedido,
                    SUM(COALESCE(c6.c6_qtdent, 0)) AS qtd_entregue,
                    MAX(TRIM(c6.c6_entreg)) AS c6_entreg
                FROM public.sc6010 c6
                WHERE c6.d_e_l_e_t_ = ''
                  AND LTRIM(UPPER(REGEXP_REPLACE(
                      REGEXP_REPLACE(
                          REGEXP_REPLACE(c6.c6_pedcli, 'dmc-?9800-?', '', 'gi'),
                          '[-/_].*|\\s+rev.*|\\s+revis.*', '', 'i'
                      ),
                      '[^a-zA-Z0-9]', '', 'g'
                  )), '0') LIKE ANY($1::text[])
                  AND (
                      (array_length($2::text[], 1) IS NOT NULL AND TRIM(c6.c6_produto) = ANY($2::text[]))
                      OR
                      UPPER(REGEXP_REPLACE(TRIM(c6.c6_produto), '[^a-zA-Z0-9]', '', 'g')) = ANY($3::text[])
                      OR
                      EXISTS (
                          SELECT 1 FROM public.sz1010 sz1
                          WHERE TRIM(sz1.z1_produto) = TRIM(c6.c6_produto)
                            AND COALESCE(sz1.d_e_l_e_t_, '') = ''
                            AND UPPER(REGEXP_REPLACE(TRIM(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g')) = ANY($3::text[])
                      )
                  )
                GROUP BY 1, TRIM(c6.c6_produto), TRIM(c6.c6_num)
            `;
            const sc6Result = await pgSync.query(querySC6, [pedidosClienteLikeArray, b1Cods.length > 0 ? b1Cods : ['___DUMMY___'], codigosClienteArray]);
            
            console.log('[VMI Sync SC6] rows:', sc6Result.rowCount);

            // Re-populate b1Cods to ensure SD2 and SC2 fetches work properly for products found via codigosClienteArray
            b1Cods = [...new Set([...b1Cods, ...sc6Result.rows.map(r => r.b1_cod)])];
            
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
                const sd2Result = await pgSync.query(querySD2, [orderNums, b1Cods]);
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

            let opMap = {};
            if (orderNums.length > 0) {
                const querySC2 = `
                    SELECT
                        TRIM(c2_pedido) AS order_num,
                        TRIM(c2_produto) AS b1_cod,
                        TRIM(c2_num) AS op_num,
                        TRIM(c2_item) AS op_item,
                        c2_quant AS op_qtd_total,
                        c2_quje AS op_qtd_entregue,
                        TRIM(c2_datprf) AS op_datprf,
                        CASE
                            WHEN c2_quje >= c2_quant AND c2_quant > 0 THEN 'Concluída'
                            WHEN c2_quje > 0 THEN 'Em Andamento'
                            ELSE 'Em Aberto'
                        END AS op_status
                    FROM public.sc2010
                    WHERE c2_pedido = ANY($1::text[])
                      AND TRIM(c2_produto) = ANY($2::text[])
                      AND COALESCE(d_e_l_e_t_, '') = ''
                `;
                const fmtProtheusDate = (s) => {
                    if (!s || s.trim() === '' || s.trim() === '00000000') return null;
                    const d = s.trim();
                    return d.length === 8 ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : null;
                };
                const sc2Result = await pgSync.query(querySC2, [orderNums, b1Cods]);
                sc2Result.rows.forEach(r => {
                    const key = `${r.order_num}_${cleanString(r.b1_cod)}`;
                    if (!opMap[key]) opMap[key] = [];
                    const progresso = r.op_qtd_total > 0 ? Math.round((r.op_qtd_entregue / r.op_qtd_total) * 100) : 0;
                    opMap[key].push({
                        op: r.op_num + (r.op_item ? r.op_item : ''),
                        progresso: Math.min(100, Math.max(0, progresso)),
                        status: r.op_status || 'Em Aberto',
                        datprf: fmtProtheusDate(r.op_datprf),
                        qtd_total: Number(r.op_qtd_total || 0),
                        qtd_entregue: Number(r.op_qtd_entregue || 0)
                    });
                });
            }

            sc6Result.rows.forEach(r => {
                const pedKey = cleanOrderNumber(r.pedcli);
                if (!sc6Map[pedKey]) sc6Map[pedKey] = [];
                
                const nfsKey = `${r.c6_num}_${cleanString(r.b1_cod)}`;
                const nfs = nfsMap[nfsKey] || [];
                
                sc6Map[pedKey].push({
                    b1_cod: r.b1_cod,
                    num: r.c6_num,
                    item: r.c6_item || '',
                    data_entrega: r.c6_entreg || '',
                    qtd: Number(r.qtd_entregue),
                    qtdven: Number(r.qtd_pedido),
                    notas_fiscais: nfs,
                    ops: opMap[nfsKey] || []
                });
            });
        }

        // ── Salva resultados no cache MySQL ──────────────────────────────────
        // Faz o mesmo match que o frontend faria, mas aqui temos todos os dados
        try {
            const cacheMap = {};
            for (const row of rows) {
                const ocKey = cleanOrderNumber(row.ordem_compra_cliente || '');
                const ocEntries = sc6Map[ocKey] || [];
                if (ocEntries.length === 0) continue;

                const b1Cod = String(row.b1_cod || '').trim();
                if (!b1Cod) continue;
                const cleanB1 = cleanString(b1Cod);
                const matching = ocEntries.filter(x => cleanString(x.b1_cod) === cleanB1);
                if (matching.length === 0) continue;

                const cacheKey = `${row.ordem_compra_cliente}||${row.codigo_produto_cliente}`;
                if (cacheMap[cacheKey]) continue; // já processado

                const qPed = matching.reduce((s, x) => s + Number(x.qtdven || 0), 0);
                const qEnt = matching.reduce((s, x) => s + Number(x.qtd || 0), 0);
                const pedidos = [...new Set(matching.map(x => x.num).filter(Boolean))].join(' / ');
                const items   = [...new Set(matching.map(x => x.item).filter(Boolean))].join(' / ');
                const allNfs  = matching.flatMap(x => x.notas_fiscais || []);
                const allOps  = matching.flatMap(x => x.ops || []);
                const dataEntrega = matching[0]?.data_entrega || '';

                cacheMap[cacheKey] = {
                    ordem_compra_cliente:  row.ordem_compra_cliente,
                    codigo_produto_cliente: row.codigo_produto_cliente,
                    pedido_metalfisa:       pedidos,
                    item_pedido:            items,
                    qtd_pedido:             qPed,
                    qtd_entregue:           qEnt,
                    saldo_entregar:         Math.max(0, qPed - qEnt),
                    notas_fiscais:          JSON.stringify(allNfs),
                    ops_relacionadas:       JSON.stringify(allOps),
                    data_entrega_comercial: dataEntrega
                };
            }

            const cacheRows = Object.values(cacheMap);
            if (cacheRows.length > 0) {
                for (const r of cacheRows) {
                    await mysqlPool.execute(`
                        INSERT INTO app_demanda_vmi_pedidos_cache
                            (ordem_compra_cliente, codigo_produto_cliente, pedido_metalfisa, item_pedido,
                             qtd_pedido, qtd_entregue, saldo_entregar, notas_fiscais, ops_relacionadas,
                             data_entrega_comercial, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE
                            pedido_metalfisa       = VALUES(pedido_metalfisa),
                            item_pedido            = VALUES(item_pedido),
                            qtd_pedido             = VALUES(qtd_pedido),
                            qtd_entregue           = VALUES(qtd_entregue),
                            saldo_entregar         = VALUES(saldo_entregar),
                            notas_fiscais          = VALUES(notas_fiscais),
                            ops_relacionadas       = VALUES(ops_relacionadas),
                            data_entrega_comercial = VALUES(data_entrega_comercial),
                            updated_at             = NOW()
                    `, [r.ordem_compra_cliente, r.codigo_produto_cliente, r.pedido_metalfisa, r.item_pedido,
                        r.qtd_pedido, r.qtd_entregue, r.saldo_entregar, r.notas_fiscais, r.ops_relacionadas,
                        r.data_entrega_comercial || '']);
                }
                console.log(`[VMI Cache] ${cacheRows.length} entradas salvas/atualizadas`);
            }
        } catch (cacheErr) {
            console.error('[VMI Cache] Erro ao salvar cache (não crítico):', cacheErr.message);
        }

        if (pgSync) pgSync.release();
        res.json({ success: true, mappings: sc6Map });
    } catch (err) {
        if (pgSync) { try { pgSync.release(); } catch (_) {} }
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

// ── PUT /api/vmi/data-entrega ──
router.put('/data-entrega', async (req, res) => {
    const { ordem_compra_cliente, codigo_produto_cliente, produto_pai, data_original, data_revisada } = req.body;
    
    if (!ordem_compra_cliente || !codigo_produto_cliente) {
        return res.status(400).json({ error: 'Pedido e Produto são obrigatórios.' });
    }

    try {
        const query = `
            INSERT INTO app_demanda_vmi_datas 
                (ordem_compra_cliente, codigo_produto_cliente, produto_pai, data_original, data_revisada, updated_by)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                data_original = COALESCE(VALUES(data_original), data_original),
                data_revisada = VALUES(data_revisada),
                produto_pai = COALESCE(VALUES(produto_pai), produto_pai),
                updated_by = VALUES(updated_by)
        `;
        
        await mysqlPool.execute(query, [
            ordem_compra_cliente, 
            codigo_produto_cliente, 
            produto_pai || null, 
            data_original || null, 
            data_revisada || null, 
            req.user?.nome || req.user?.NomeCompleto || null
        ]);

        res.json({ success: true, msg: 'Data atualizada com sucesso.' });
    } catch (err) {
        console.error('[VMI PUT data-entrega Error]', err);
        res.status(500).json({ error: 'Erro ao atualizar a data de entrega.', details: err.message });
    }
});

// ── GET /api/vmi/comparacao-diaria ──
router.get('/comparacao-diaria', async (req, res) => {
    try {
        const [datas] = await mysqlPool.query(`
            SELECT DISTINCT data_referencia 
            FROM app_demanda_vmi_entregas_log 
            ORDER BY data_referencia DESC 
            LIMIT 2
        `);
        
        if (datas.length < 2) {
            return res.json({ 
                comparacao: [], 
                dias: datas.map(d => d.data_referencia),
                msg: 'São necessários pelo menos 2 dias de histórico para comparação.' 
            });
        }
        
        const diaHoje = datas[0].data_referencia;
        const diaOntem = datas[1].data_referencia;

        const [comparacao] = await mysqlPool.query(`
            SELECT 
                h.ordem_compra_cliente, 
                h.codigo_produto_cliente,
                COALESCE(o.qtd_entregue, 0) as entregue_ontem,
                h.qtd_entregue as entregue_hoje,
                (h.qtd_entregue - COALESCE(o.qtd_entregue, 0)) as delta_entregue
            FROM app_demanda_vmi_entregas_log h
            LEFT JOIN app_demanda_vmi_entregas_log o 
              ON o.ordem_compra_cliente = h.ordem_compra_cliente 
             AND o.codigo_produto_cliente = h.codigo_produto_cliente 
             AND o.data_referencia = ?
            WHERE h.data_referencia = ? 
              AND (h.qtd_entregue - COALESCE(o.qtd_entregue, 0)) <> 0
            ORDER BY delta_entregue DESC
        `, [diaOntem, diaHoje]);

        res.json({
            dias: { hoje: diaHoje, ontem: diaOntem },
            comparacao
        });

    } catch (err) {
        console.error('[VMI GET comparacao-diaria Error]', err);
        res.status(500).json({ error: 'Erro ao gerar comparativo diário.', details: err.message });
    }
});

// ── POST /api/vmi/snapshot ──
router.post('/snapshot', async (req, res) => {
    try {
        const { rows } = req.body;
        if (!rows || rows.length === 0) return res.json({ success: true });

        const hoje = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0];

        await mysqlPool.query(`DELETE FROM app_demanda_vmi_entregas_log WHERE data_referencia = ?`, [hoje]);

        const pushParams = [];
        const seen = new Set();
        
        for (const r of rows) {
            const qtd = Number(r.qtd_entregue) || 0;
            const key = `${r.ordem_compra_cliente}_${r.codigo_produto_cliente}`;
            
            if (!seen.has(key)) {
                seen.add(key);
                pushParams.push([hoje, r.ordem_compra_cliente, r.codigo_produto_cliente, qtd, 0]);
            }
        }

        if (pushParams.length > 0) {
            const CHUNK_SIZE = 1000;
            for (let i = 0; i < pushParams.length; i += CHUNK_SIZE) {
                const chunk = pushParams.slice(i, i + CHUNK_SIZE);
                await mysqlPool.query(
                    `INSERT INTO app_demanda_vmi_entregas_log (data_referencia, ordem_compra_cliente, codigo_produto_cliente, qtd_entregue, qtd_delta) VALUES ?`, 
                    [chunk]
                );
            }
        }

        res.json({ success: true, msg: 'Snapshot diário de entregas atualizado.' });
    } catch (err) {
        console.error('[VMI POST snapshot Error]', err);
        res.status(500).json({ error: 'Erro ao gerar snapshot.', details: err.message });
    }
});

// ── POST /api/vmi/pedidos-cache ──
router.post('/pedidos-cache', async (req, res) => {
    try {
        const { rows } = req.body;
        if (!rows || rows.length === 0) return res.json({ success: true });

        const pushParams = [];
        const seen = new Set();
        
        for (const r of rows) {
            if (!r.pedido_metalfisa && r.qtd_pedido == null) continue;

            const key = `${r.ordem_compra_cliente}_${r.codigo_produto_cliente}`;
            if (!seen.has(key)) {
                seen.add(key);
                pushParams.push([
                    r.ordem_compra_cliente,
                    r.codigo_produto_cliente,
                    r.pedido_metalfisa || null,
                    r.data_criacao_metalfisa || null,
                    r.data_entrega_metalfisa || null,
                    Number(r.qtd_pedido) || 0,
                    Number(r.qtd_entregue) || 0,
                    Number(r.saldo_entregar) || 0,
                    r.notas_fiscais ? JSON.stringify(r.notas_fiscais) : null
                ]);
            }
        }

        if (pushParams.length > 0) {
            const CHUNK_SIZE = 500;
            for (let i = 0; i < pushParams.length; i += CHUNK_SIZE) {
                const chunk = pushParams.slice(i, i + CHUNK_SIZE);
                await mysqlPool.query(
                    `INSERT INTO app_demanda_vmi_pedidos_cache 
                    (ordem_compra_cliente, codigo_produto_cliente, pedido_metalfisa, data_criacao_metalfisa, data_entrega_metalfisa, qtd_pedido, qtd_entregue, saldo_entregar, notas_fiscais) 
                    VALUES ?
                    ON DUPLICATE KEY UPDATE 
                        pedido_metalfisa = VALUES(pedido_metalfisa),
                        data_criacao_metalfisa = VALUES(data_criacao_metalfisa),
                        data_entrega_metalfisa = VALUES(data_entrega_metalfisa),
                        qtd_pedido = VALUES(qtd_pedido),
                        qtd_entregue = VALUES(qtd_entregue),
                        saldo_entregar = VALUES(saldo_entregar),
                        notas_fiscais = VALUES(notas_fiscais),
                        updated_at = CURRENT_TIMESTAMP
                    `,
                    [chunk]
                );
            }
        }

        res.json({ success: true, msg: 'Cache de pedidos atualizado.' });
    } catch (err) {
        console.error('[VMI POST pedidos-cache Error]', err);
        res.status(500).json({ error: 'Erro ao atualizar cache de pedidos.', details: err.message });
    }
});

// ── POST /api/vmi/ops-progresso ──
router.post('/ops-progresso', async (req, res) => {
    try {
        const { itens } = req.body;
        if (!itens || !itens.length) return res.json({ ops: {} });

        // Extrai os produtos (b1_cod) e cria uma lista de produtos únicos
        const b1Cods = [...new Set(itens.map(i => i.b1_cod).filter(Boolean))];
        if (b1Cods.length === 0) return res.json({ ops: {} });

        const pgPool = require('../protheusDb');

        const inClause = b1Cods.map((_, i) => `$${i + 1}`).join(',');
        
        // Busca as OPs abertas (ou recém fechadas) para esses produtos
        // Filtramos por OPs que ainda não foram totalmente apontadas ou cujo saldo é relevante
        // c2_quant = Qtd Total da OP
        // c2_quje = Qtd Já Entregue (Apontada)
        const query = `
            SELECT 
                TRIM(c2_num) AS op_num,
                TRIM(c2_produto) AS b1_cod,
                TRIM(c2_pedido) AS pedido_metalfisa,
                TRIM(c2_emissao) AS data_criacao,
                c2_quant AS qtd_total,
                c2_quje AS qtd_apontada
            FROM public.sc2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
              AND TRIM(c2_produto) IN (${inClause})
              AND TRIM(c2_datrf) = ''
        `;

        const result = await pgPool.query(query, b1Cods);

        const opsMap = {};

        // Organiza as OPs pelo formato esperado no frontend: `b1_cod||pedido_metalfisa`
        result.rows.forEach(r => {
            const progresso = r.qtd_total > 0 ? Math.round((r.qtd_apontada / r.qtd_total) * 100) : 0;
            const opData = {
                op_num: r.op_num,
                data_criacao: r.data_criacao ? `${r.data_criacao.substring(6,8)}/${r.data_criacao.substring(4,6)}/${r.data_criacao.substring(0,4)}` : '',
                progresso: Math.min(100, Math.max(0, progresso))
            };

            // O Frontend tenta combinar b1_cod e pedido_metalfisa
            // Vamos associar a OP à chave exata que o frontend aguarda
            const key = `${r.b1_cod}||${r.pedido_metalfisa || ''}`;
            
            if (!opsMap[key]) {
                opsMap[key] = [];
            }
            // Evita duplicidade de num OP no array (caso SC2010 tenha quebras por sequencia)
            if (!opsMap[key].some(x => x.op_num === r.op_num)) {
                opsMap[key].push(opData);
            }
            
            // Caso a OP no Protheus esteja sem pedido (para estoque), associa apenas ao b1_cod genérico
            if (r.pedido_metalfisa === '') {
                // Tenta associar a TODOS os itens que tem esse b1_cod na request
                itens.filter(i => i.b1_cod === r.b1_cod).forEach(itemReq => {
                    const reqKey = `${itemReq.b1_cod}||${itemReq.pedido_metalfisa || ''}`;
                    if (!opsMap[reqKey]) opsMap[reqKey] = [];
                    if (!opsMap[reqKey].some(x => x.op_num === r.op_num)) {
                        opsMap[reqKey].push(opData);
                    }
                });
            }
        });

        res.json({ success: true, ops: opsMap });

    } catch (err) {
        console.error('[VMI POST ops-progresso Error]', err);
        res.status(500).json({ error: 'Erro ao buscar progresso das OPs', details: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OC'S DE FORNECEDORES — Upload, Salvamento, Listagem e Cruzamento
// ═══════════════════════════════════════════════════════════════════════════════

// Normaliza um código de produto Metalfisa (ex: "33.12.10537.00" → "3312105370")
// Remove apenas caracteres não-alfanuméricos, mantém TODOS os dígitos/letras
function normalizeProdutoCode(str) {
    if (!str) return '';
    return String(str).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// Busca o b1_cod no Protheus a partir do código normalizado da coluna C
// Estratégia: primeiro tenta SB1 direto (pois Col C já é código Metalfisa),
// depois SZ1 como fallback (tabela de mapeamento cliente-produto)
async function lookupB1CodFromProduto(normalizedCode) {
    if (!normalizedCode || normalizedCode.length < 3) return null;
    const searchCode = normalizedCode.length > 9 ? normalizedCode.substring(0, 9) : normalizedCode;
    const EXCLUDED_PREFIXES = 'MTC|SCL|MTI|MTA|MT8|MMP|MT7|MT1|MTB|COM';
    try {
        // 1. Busca direta no SB1 (catálogo de produtos Metalfisa)
        const sb1Result = await db.query(`
            SELECT TRIM(b1_cod) as b1_cod
            FROM public.sb1010
            WHERE upper(regexp_replace(trim(b1_cod), '[^a-zA-Z0-9]', '', 'g')) = $1
              AND COALESCE(d_e_l_e_t_, '') <> '*'
              AND trim(b1_cod) !~* $2
            LIMIT 1
        `, [searchCode, EXCLUDED_PREFIXES]);
        if (sb1Result.rows.length > 0) return sb1Result.rows[0].b1_cod;

        // 2. Busca parcial no SB1 (primeiros 9 chars)
        const sb1Partial = await db.query(`
            SELECT TRIM(b1_cod) as b1_cod
            FROM public.sb1010
            WHERE upper(left(regexp_replace(trim(b1_cod), '[^a-zA-Z0-9]', '', 'g'), ${searchCode.length})) = $1
              AND COALESCE(d_e_l_e_t_, '') <> '*'
              AND trim(b1_cod) !~* $2
            LIMIT 1
        `, [searchCode, EXCLUDED_PREFIXES]);
        if (sb1Partial.rows.length > 0) return sb1Partial.rows[0].b1_cod;

        // 3. Fallback: SZ1 (z1_codcli → z1_produto)
        const sz1Result = await db.query(`
            SELECT TRIM(z1_produto) as b1_cod
            FROM public.sz1010
            WHERE upper(regexp_replace(trim(z1_codcli), '[^a-zA-Z0-9]', '', 'g')) ILIKE $1
              AND COALESCE(d_e_l_e_t_, '') <> '*'
              AND trim(z1_produto) <> ''
            LIMIT 1
        `, [`%${searchCode}%`]);
        if (sz1Result.rows.length > 0) return sz1Result.rows[0].b1_cod;

    } catch (err) {
        console.error(`[OC b1_cod lookup] Erro para "${normalizedCode}":`, err.message);
    }
    return null;
}

// ── POST /api/vmi/oc-fornecedores/upload ──────────────────────────────────────
// Recebe o arquivo xlsx, faz parse, resolve b1_cod e retorna preview (sem salvar)
router.post('/oc-fornecedores/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

        const wb = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

        if (rows.length < 2) return res.status(400).json({ error: 'Planilha vazia ou inválida.' });

        // Validação do cabeçalho esperado (Col C deve conter PRODUTO)
        const header = rows[0] || [];
        const headerNorm = header.map(h => String(h || '').trim().toUpperCase());
        if (!headerNorm.includes('PRODUTO') && !headerNorm.includes('OC')) {
            return res.status(400).json({
                error: 'Formato de planilha inválido. Esperado: OC, ITEM_OC, PRODUTO, DESC_PRODUTO, NOME_FORNECEDOR, DT_EMISSAO, DT_NEG, RESPONSAVEL, QTDE_EM_ABERTO, CUSTO_UNI, CUSTO_TOTAL, SITUACAO, ARM',
                modelo_invalido: true
            });
        }

        // Mapeia índices das colunas dinamicamente (robusto a reordenação)
        const colIdx = {};
        headerNorm.forEach((h, i) => { colIdx[h] = i; });
        const ci = (name) => colIdx[name] ?? -1;

        const parseDate = (v) => {
            if (!v) return null;
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            const s = String(v).trim();
            // DD/MM/YYYY
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
                const [d, m, y] = s.split('/');
                return `${y}-${m}-${d}`;
            }
            try { const dt = new Date(s); return isNaN(dt) ? null : dt.toISOString().slice(0, 10); } catch { return null; }
        };
        const parseNum = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            const n = parseFloat(String(v).replace(',', '.'));
            return isNaN(n) ? 0 : n;
        };

        // Parse das linhas de dados
        const itens = [];
        const produtosUnicos = new Set();
        const ocsUnicas = new Set();

        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            const oc      = ci('OC')      >= 0 ? String(row[ci('OC')]      || '').trim() : '';
            const produto  = ci('PRODUTO') >= 0 ? String(row[ci('PRODUTO')] || '').trim() : '';
            if (!oc && !produto) continue; // linha em branco

            const item = {
                oc,
                item_oc:        ci('ITEM_OC')        >= 0 ? String(row[ci('ITEM_OC')]        || '').trim() : '',
                produto,
                produto_clean:  normalizeProdutoCode(produto),
                desc_produto:   ci('DESC_PRODUTO')   >= 0 ? String(row[ci('DESC_PRODUTO')]   || '').trim() : '',
                nome_fornecedor:ci('NOME_FORNECEDOR') >= 0 ? String(row[ci('NOME_FORNECEDOR')]|| '').trim() : '',
                dt_emissao:     parseDate(ci('DT_EMISSAO')  >= 0 ? row[ci('DT_EMISSAO')]  : null),
                dt_neg:         parseDate(ci('DT_NEG')       >= 0 ? row[ci('DT_NEG')]       : null),
                responsavel:    ci('RESPONSAVEL')    >= 0 ? String(row[ci('RESPONSAVEL')]    || '').trim() : '',
                qtde_em_aberto: parseNum(ci('QTDE_EM_ABERTO') >= 0 ? row[ci('QTDE_EM_ABERTO')] : 0),
                custo_uni:      parseNum(ci('CUSTO_UNI')       >= 0 ? row[ci('CUSTO_UNI')]       : 0),
                custo_total:    parseNum(ci('CUSTO_TOTAL')     >= 0 ? row[ci('CUSTO_TOTAL')]     : 0),
                situacao:       ci('SITUACAO')       >= 0 ? String(row[ci('SITUACAO')]       || '').trim() : '',
                arm:            ci('ARM')            >= 0 ? String(row[ci('ARM')]            || '').trim() : '',
                b1_cod:         null // será resolvido abaixo
            };

            if (produto) produtosUnicos.add(produto);
            if (oc) ocsUnicas.add(oc);
            itens.push(item);
        }

        if (itens.length === 0) return res.status(400).json({ error: 'Nenhum item válido encontrado na planilha.' });

        // Resolve b1_cod em paralelo para todos os produtos únicos
        const produtosArr = [...produtosUnicos];
        const b1CodMap = {};

        // Primeiro: verifica mapeamento manual (app_demanda_vmi_map) para produto_clean
        const cleanCodes = produtosArr.map(p => normalizeProdutoCode(p)).filter(Boolean);
        if (cleanCodes.length > 0) {
            try {
                const [mapRows] = await mysqlPool.query(
                    `SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map
                     WHERE REPLACE(REPLACE(REPLACE(codigo_produto_cliente, '.', ''), '-', ''), '_', '') IN (${cleanCodes.map(() => '?').join(',')})`,
                    cleanCodes
                );
                mapRows.forEach(m => {
                    const clean = normalizeProdutoCode(m.codigo_produto_cliente);
                    if (clean && m.b1_cod) b1CodMap[clean] = m.b1_cod;
                });
            } catch (_) {}
        }

        // Para os que não foram resolvidos pelo mapeamento manual: busca no Protheus
        const semB1 = produtosArr.filter(p => !b1CodMap[normalizeProdutoCode(p)]);
        if (semB1.length > 0) {
            const lookups = await Promise.all(semB1.map(async p => ({
                produto: p,
                b1_cod: await lookupB1CodFromProduto(normalizeProdutoCode(p))
            })));
            lookups.forEach(({ produto, b1_cod }) => {
                if (b1_cod) b1CodMap[normalizeProdutoCode(produto)] = b1_cod;
            });
        }

        // Aplica b1_cod nos itens
        itens.forEach(item => {
            item.b1_cod = b1CodMap[item.produto_clean] || null;
        });

        // Estatísticas para o preview
        const qtdeTotal   = itens.reduce((s, i) => s + i.qtde_em_aberto, 0);
        const custoTotal  = itens.reduce((s, i) => s + i.custo_total, 0);
        const mapeados    = itens.filter(i => i.b1_cod).length;

        res.json({
            success: true,
            preview: itens,
            stats: {
                total_linhas:   itens.length,
                total_produtos: produtosUnicos.size,
                total_ocs:      ocsUnicas.size,
                qtde_total:     qtdeTotal,
                custo_total:    custoTotal,
                mapeados,
                sem_b1cod:      itens.length - mapeados
            },
            nome_arquivo: req.file.originalname ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : 'Lote',
            sheet_name:   sheetName
        });

    } catch (err) {
        console.error('[OC Upload]', err);
        res.status(500).json({ error: 'Erro ao processar arquivo: ' + err.message });
    }
});

// ── POST /api/vmi/oc-fornecedores/save ───────────────────────────────────────
// Salva o lote previamente processado no banco
router.post('/oc-fornecedores/save', async (req, res) => {
    const { itens, nome_arquivo, sheet_name } = req.body;
    if (!Array.isArray(itens) || itens.length === 0)
        return res.status(400).json({ error: 'Nenhum item para salvar.' });

    const lote_id     = uuidv4();
    const qtdeTotal   = itens.reduce((s, i) => s + Number(i.qtde_em_aberto || 0), 0);
    const custoTotal  = itens.reduce((s, i) => s + Number(i.custo_total    || 0), 0);
    const prodUnicos  = new Set(itens.map(i => i.produto).filter(Boolean)).size;
    const ocsUnicas   = new Set(itens.map(i => i.oc).filter(Boolean)).size;
    const hashContent = require('crypto').createHash('md5').update(JSON.stringify(itens.slice(0, 5))).digest('hex');

    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(
            `INSERT INTO app_vmi_oc_lotes
             (lote_id, nome_arquivo, hash_conteudo, total_linhas, total_produtos, total_ocs, qtde_total, custo_total, usuario_id, usuario_nome)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lote_id, nome_arquivo || '', hashContent, itens.length, prodUnicos, ocsUnicas,
             qtdeTotal, custoTotal,
             req.user?.id || req.user?.idUsuario || null,
             req.user?.nome || req.user?.NomeCompleto || null]
        );

        // Bulk insert por chunks de 200
        const CHUNK = 200;
        for (let i = 0; i < itens.length; i += CHUNK) {
            const chunk = itens.slice(i, i + CHUNK);
            const values = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
            const params = chunk.flatMap(item => [
                lote_id,
                item.oc            || null,
                item.item_oc       || null,
                item.produto       || null,
                item.produto_clean || null,
                item.desc_produto  || null,
                item.nome_fornecedor || null,
                item.dt_emissao    || null,
                item.dt_neg        || null,
                item.responsavel   || null,
                Number(item.qtde_em_aberto || 0),
                Number(item.custo_uni      || 0),
                Number(item.custo_total    || 0),
                item.situacao      || null,
                item.arm           || null,
                item.b1_cod        || null,
                item.produto_clean || null  // duplicate for produto_clean already set above
            ]);
            // Ajuste: 17 params por linha mas a tabela tem 16 campos (sem id AUTO)
            const values16 = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
            const params16 = chunk.flatMap(item => [
                lote_id,
                item.oc            || null,
                item.item_oc       || null,
                item.produto       || null,
                item.produto_clean || null,
                item.desc_produto  || null,
                item.nome_fornecedor || null,
                item.dt_emissao    || null,
                item.dt_neg        || null,
                item.responsavel   || null,
                Number(item.qtde_em_aberto || 0),
                Number(item.custo_uni      || 0),
                Number(item.custo_total    || 0),
                item.situacao      || null,
                item.arm           || null,
                item.b1_cod        || null
            ]);
            await conn.query(
                `INSERT INTO app_vmi_oc_itens
                 (lote_id, oc, item_oc, produto, produto_clean, desc_produto, nome_fornecedor,
                  dt_emissao, dt_neg, responsavel, qtde_em_aberto, custo_uni, custo_total,
                  situacao, arm, b1_cod)
                 VALUES ${values16}`,
                params16
            );
        }

        await conn.commit();
        res.json({ success: true, lote_id, msg: `${itens.length} itens salvos com sucesso!` });

    } catch (err) {
        await conn.rollback();
        console.error('[OC Save]', err);
        res.status(500).json({ error: 'Erro ao salvar lote: ' + err.message });
    } finally {
        conn.release();
    }
});

// ── GET /api/vmi/oc-fornecedores/lotes ──────────────────────────────────────
router.get('/oc-fornecedores/lotes', async (req, res) => {
    try {
        const canViewFinancials = await hasFinancialAccess(req);
        const [rows] = await mysqlPool.query(
            `SELECT lote_id, nome_arquivo, total_linhas, total_produtos, total_ocs,
                    qtde_total, custo_total, usuario_nome, created_at
             FROM app_vmi_oc_lotes
             ORDER BY created_at DESC
             LIMIT 20`
        );
        const data = canViewFinancials ? rows : rows.map(({ custo_total, ...rest }) => rest);
        res.json({ success: true, data });
    } catch (err) {
        console.error('[OC Lotes GET]', err);
        res.status(500).json({ error: 'Erro ao listar lotes.' });
    }
});

// ── GET /api/vmi/oc-fornecedores ────────────────────────────────────────────
// Retorna dados agrupados por produto (Col C), com soma de QTDE_EM_ABERTO
// Suporta filtros: ?lote=, ?situacao=, ?fornecedor=, ?search=
router.get('/oc-fornecedores', async (req, res) => {
    try {
        const canViewFinancials = await hasFinancialAccess(req);
        const { lote, situacao, fornecedor, search } = req.query;

        let where = ['1=1'];
        let params = [];

        if (lote)       { where.push('lote_id = ?');            params.push(lote); }
        if (situacao)   { where.push('situacao = ?');           params.push(situacao); }
        if (fornecedor) { where.push('nome_fornecedor LIKE ?'); params.push(`%${fornecedor}%`); }
        if (search)     { where.push('(produto LIKE ? OR desc_produto LIKE ? OR oc LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

        const whereClause = where.join(' AND ');

        // Busca os itens individuais para agrupamento no backend
        const [rows] = await mysqlPool.query(
            `SELECT oc, item_oc, produto, produto_clean, desc_produto, nome_fornecedor,
                    dt_emissao, dt_neg, responsavel, qtde_em_aberto, custo_uni, custo_total,
                    situacao, arm, b1_cod, lote_id, custo_protheus
             FROM app_vmi_oc_itens
             WHERE ${whereClause}
             ORDER BY produto, oc, item_oc`,
            params
        );

        // Busca demandas VMI para cruzamento via b1_cod (saldo VMI em aberto)
        const b1Cods = [...new Set(rows.map(r => r.b1_cod).filter(Boolean))];
        const demandaMap = {};
        const pdfMap = {};
        const protheusPrecoMap = {}; // custo médio Protheus por b1_cod
        if (b1Cods.length > 0) {
            try {
                const [demRows] = await mysqlPool.query(
                    `SELECT b1_cod,
                            SUM(saldo_entregar) as saldo_vmi,
                            SUM(qtd_pedido)     as qtd_pedido_vmi,
                            SUM(qtd_entregue)   as qtd_entregue_vmi
                     FROM app_demanda_vmi_pedidos_cache
                     WHERE b1_cod IN (${b1Cods.map(() => '?').join(',')})
                     GROUP BY b1_cod`,
                    b1Cods
                );
                demRows.forEach(r => { demandaMap[r.b1_cod] = r; });
            } catch (_) { /* tabela pode não existir ainda */ }

            // Busca PDF url via produtos_docs — mesma lógica da página /produtos
            try {
                const [pdfRows] = await mysqlPool.execute(
                    `SELECT produto_codigo, url_arquivo
                     FROM produtos_docs
                     WHERE produto_codigo IN (${b1Cods.map(() => '?').join(',')})
                     ORDER BY CASE WHEN tipo = 'Desenho' THEN 0 ELSE 1 END, created_at DESC`,
                    b1Cods
                );
                // Pega somente o primeiro resultado por produto (Desenho priorizado)
                pdfRows.forEach(r => {
                    const key = String(r.produto_codigo).trim();
                    if (!pdfMap[key]) pdfMap[key] = r.url_arquivo;
                });
            } catch (pdfErr) {
                console.warn('[VMI OC] Aviso: não foi possível buscar PDFs em produtos_docs:', pdfErr.message);
            }

            // Busca custo médio (B1_CUSTD) no Protheus via SB1010
            try {
                const placeholders = b1Cods.map((_, i) => `$${i + 1}`).join(',');
                const protheusRes = await db.query(
                    `SELECT TRIM(B1_COD) AS b1_cod,
                            COALESCE(B1_CUSTD, 0)::numeric AS custo_medio,
                            COALESCE(B1_UPRC,  0)::numeric AS custo_padrao
                     FROM public.SB1010
                     WHERE TRIM(COALESCE(D_E_L_E_T_, '')) = ''
                       AND TRIM(B1_COD) = ANY(ARRAY[${placeholders}])`,
                    b1Cods
                );
                protheusRes.rows.forEach(r => {
                    protheusPrecoMap[String(r.b1_cod).trim()] = {
                        custo_medio:  Number(r.custo_medio  || 0),
                        custo_padrao: Number(r.custo_padrao || 0)
                    };
                });
            } catch (prErr) {
                console.warn('[VMI OC] Aviso: não foi possível buscar preços no Protheus:', prErr.message);
            }
        }

        // Agrupa por produto
        const grupos = {};
        rows.forEach(row => {
            const key = row.produto || `_SEM_PRODUTO_${row.oc}`;
            if (!grupos[key]) {
                const b1key = row.b1_cod ? String(row.b1_cod).trim() : null;
                // custo_protheus: preferência ao valor salvo no banco; fallback ao map on-the-fly
                const dbPreco  = row.custo_protheus != null ? Number(row.custo_protheus) : null;
                const livePreco = b1key ? (protheusPrecoMap[b1key] || null) : null;
                grupos[key] = {
                    produto:           row.produto,
                    produto_clean:     row.produto_clean,
                    desc_produto:      row.desc_produto,
                    b1_cod:            row.b1_cod,
                    pdf_url:           b1key ? (pdfMap[b1key] || null) : null,
                    qtde_total:        0,
                    custo_total:       0,
                    custo_uni:         Number(row.custo_uni || 0),
                    custo_protheus:    dbPreco != null
                                           ? { custo_medio: dbPreco, custo_padrao: dbPreco }
                                           : livePreco,
                    custo_protheus_salvo: dbPreco != null, // indica se já foi sincronizado
                    itens:             [],
                    ocs:               new Set(),
                    fornecedores:      new Set(),
                    situacoes:         new Set(),
                    demanda_vmi:       row.b1_cod ? (demandaMap[row.b1_cod] || null) : null
                };
            }
            const g = grupos[key];
            g.qtde_total  += Number(row.qtde_em_aberto || 0);
            g.custo_total += Number(row.custo_total    || 0);
            if (!g.custo_uni && row.custo_uni) g.custo_uni = Number(row.custo_uni);
            // Se algum item do grupo já tem custo_protheus salvo no banco, usa ele
            if (row.custo_protheus != null && !g.custo_protheus_salvo) {
                const dbP = Number(row.custo_protheus);
                g.custo_protheus = { custo_medio: dbP, custo_padrao: dbP };
                g.custo_protheus_salvo = true;
            }
            g.itens.push(row);
            if (row.oc)              g.ocs.add(row.oc);
            if (row.nome_fornecedor) g.fornecedores.add(row.nome_fornecedor);
            if (row.situacao)        g.situacoes.add(row.situacao);
            if (!g.b1_cod && row.b1_cod) {
                const bk = String(row.b1_cod).trim();
                g.b1_cod        = row.b1_cod;
                g.demanda_vmi   = demandaMap[row.b1_cod] || null;
                if (!g.custo_protheus_salvo) g.custo_protheus = protheusPrecoMap[bk] || null;
                if (!g.pdf_url) g.pdf_url = pdfMap[bk] || null;
            }
        });

        // Serializa Sets para arrays
        const resultado = Object.values(grupos).map(g => ({
            ...g,
            ocs:         [...g.ocs],
            fornecedores:[...g.fornecedores],
            situacoes:   [...g.situacoes]
        })).sort((a, b) => (a.produto || '').localeCompare(b.produto || ''));

        // Totais gerais
        const totalQtde  = resultado.reduce((s, g) => s + g.qtde_total,  0);
        const totalCusto = resultado.reduce((s, g) => s + g.custo_total, 0);
        const totalItens = rows.length;

        const totais = { total_grupos: resultado.length, total_itens: totalItens, qtde_total: totalQtde, custo_total: totalCusto };

        const dataFinal = canViewFinancials
            ? resultado
            : resultado.map(({ custo_total, custo_uni, custo_protheus, custo_protheus_salvo, itens, ...rest }) => ({
                  ...rest,
                  itens: itens.map(({ custo_uni, custo_total, custo_protheus, ...itemRest }) => itemRest)
              }));
        const totaisFinal = canViewFinancials
            ? totais
            : (({ custo_total, ...restTotais }) => restTotais)(totais);

        res.json({
            success: true,
            data:    dataFinal,
            totais:  totaisFinal
        });

    } catch (err) {
        console.error('[OC GET]', err);
        res.status(500).json({ error: 'Erro ao buscar dados: ' + err.message });
    }
});

// ── POST /api/vmi/oc-fornecedores/lotes/:loteId/sync-prices ──────────────────
// Busca B1_CUSTD no Protheus para cada item com b1_cod e salva em custo_protheus
router.post('/oc-fornecedores/lotes/:loteId/sync-prices', async (req, res) => {
    const { loteId } = req.params;
    try {
        // 1. Busca todos os itens com b1_cod do lote
        const [itens] = await mysqlPool.query(
            `SELECT id, b1_cod FROM app_vmi_oc_itens
             WHERE lote_id = ? AND b1_cod IS NOT NULL AND b1_cod <> ''`,
            [loteId]
        );

        if (itens.length === 0)
            return res.json({ success: true, atualizados: 0, msg: 'Nenhum item com b1_cod para buscar preço.' });

        // 2. Lista única de b1_cods
        const b1Cods = [...new Set(itens.map(i => String(i.b1_cod).trim()).filter(Boolean))];

        // 3. Busca B1_CUSTD em lote no Protheus
        const precoMap = {};
        try {
            const placeholders = b1Cods.map((_, i) => `$${i + 1}`).join(',');
            const pgRes = await db.query(
                `SELECT TRIM(SB1.B1_COD) AS b1_cod,
                        COALESCE(
                            NULLIF(SB1.B1_CUSTD, 0), 
                            (SELECT C6_PRCVEN FROM public.SC6010 WHERE TRIM(C6_PRODUTO) = TRIM(SB1.B1_COD) AND TRIM(COALESCE(D_E_L_E_T_, '')) = '' ORDER BY R_E_C_N_O_ DESC LIMIT 1),
                            0
                        )::numeric AS custo_medio
                 FROM public.SB1010 SB1
                 WHERE TRIM(COALESCE(SB1.D_E_L_E_T_, '')) = ''
                   AND TRIM(SB1.B1_COD) = ANY(ARRAY[${placeholders}])`,
                b1Cods
            );
            pgRes.rows.forEach(r => {
                precoMap[String(r.b1_cod).trim()] = Number(r.custo_medio || 0);
            });
        } catch (pgErr) {
            return res.status(500).json({ error: 'Erro ao consultar Protheus: ' + pgErr.message });
        }

        // 4. Salva custo_protheus nos itens
        let atualizados = 0;
        const conn = await mysqlPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const item of itens) {
                const bk    = String(item.b1_cod).trim();
                const preco = precoMap[bk];
                if (preco !== undefined) {
                    await conn.query(
                        'UPDATE app_vmi_oc_itens SET custo_protheus = ? WHERE id = ?',
                        [preco, item.id]
                    );
                    atualizados++;
                }
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        const semPreco = b1Cods.length - Object.keys(precoMap).length;
        res.json({
            success: true,
            atualizados,
            total_verificados: itens.length,
            sem_preco: semPreco,
            msg: `${atualizados} itens atualizados com preço Protheus.${ semPreco > 0 ? ` ${semPreco} produto(s) sem custo cadastrado.` : '' }`
        });

    } catch (err) {
        console.error('[OC Sync Prices]', err);
        res.status(500).json({ error: 'Erro ao sincronizar preços: ' + err.message });
    }
});

// ── POST /api/vmi/oc-fornecedores/lotes/:loteId/resync ───────────────────────
// Re-resolve b1_cod no Protheus para todos os itens do lote.
// Query param: ?force=true → re-resolve TODOS (inclusive os que já têm b1_cod)
router.post('/oc-fornecedores/lotes/:loteId/resync', async (req, res) => {
    const { loteId } = req.params;
    const force = req.query.force === 'true';

    try {
        // Busca os itens do lote
        const whereB1 = force ? '1=1' : 'b1_cod IS NULL';
        const [itens] = await mysqlPool.query(
            `SELECT id, produto, produto_clean FROM app_vmi_oc_itens
             WHERE lote_id = ? AND ${whereB1}`,
            [loteId]
        );

        if (itens.length === 0) {
            return res.json({ success: true, atualizados: 0, msg: 'Nenhum item para atualizar.' });
        }

        // Coleta produtos únicos (sem b1_cod) para resolver
        const produtosUnicos = [...new Set(itens.map(i => i.produto_clean || normalizeProdutoCode(i.produto)).filter(Boolean))];

        const b1CodMap = {};

        // 1. Mapeamento manual (app_demanda_vmi_map)
        if (produtosUnicos.length > 0) {
            try {
                const [mapRows] = await mysqlPool.query(
                    `SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map
                     WHERE REPLACE(REPLACE(REPLACE(codigo_produto_cliente, '.', ''), '-', ''), '_', '') IN (${produtosUnicos.map(() => '?').join(',')})`,
                    produtosUnicos
                );
                mapRows.forEach(m => {
                    const clean = normalizeProdutoCode(m.codigo_produto_cliente);
                    if (clean && m.b1_cod) b1CodMap[clean] = m.b1_cod;
                });
            } catch (_) {}
        }

        // 2. Busca no Protheus para os que ainda não foram resolvidos
        const semB1 = produtosUnicos.filter(p => !b1CodMap[p]);
        if (semB1.length > 0) {
            const lookups = await Promise.all(semB1.map(async p => ({
                produto_clean: p,
                b1_cod: await lookupB1CodFromProduto(p)
            })));
            lookups.forEach(({ produto_clean, b1_cod }) => {
                if (b1_cod) b1CodMap[produto_clean] = b1_cod;
            });
        }

        // 3. Atualiza no banco somente os que tiveram b1_cod resolvido
        let atualizados = 0;
        const conn = await mysqlPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const item of itens) {
                const clean = item.produto_clean || normalizeProdutoCode(item.produto);
                const b1 = b1CodMap[clean] || null;
                if (b1) {
                    await conn.query(
                        'UPDATE app_vmi_oc_itens SET b1_cod = ? WHERE id = ?',
                        [b1, item.id]
                    );
                    atualizados++;
                }
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        res.json({
            success: true,
            atualizados,
            total_verificados: itens.length,
            msg: `${atualizados} de ${itens.length} itens atualizados com b1_cod do Protheus.`
        });

    } catch (err) {
        console.error('[OC Resync]', err);
        res.status(500).json({ error: 'Erro ao re-sincronizar: ' + err.message });
    }
});



router.delete('/oc-fornecedores/lotes/:loteId', async (req, res) => {
    const { loteId } = req.params;
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM app_vmi_oc_itens WHERE lote_id = ?', [loteId]);
        await conn.query('DELETE FROM app_vmi_oc_lotes WHERE lote_id = ?', [loteId]);
        await conn.commit();
        res.json({ success: true, msg: 'Lote removido com sucesso.' });
    } catch (err) {
        await conn.rollback();
        console.error('[OC Delete Lote]', err);
        res.status(500).json({ error: 'Erro ao remover lote.' });
    } finally {
        conn.release();
    }
});

// =========================================================================
// ── DEMANDA MÊS: UPLOAD E CRUZAMENTO COM PROTHEUS + SINCO ───────────────
// =========================================================================
router.post('/demanda-mes/processar', upload.single('planilha'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo Excel fornecido.' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        // Escolhe a primeira aba ou a aba 'METALFISA' se existir
        const sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('METALFISA')) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            return res.status(400).json({ error: 'Nenhuma aba encontrada no arquivo Excel.' });
        }

        // Limita o range da planilha para as linhas reais preenchidas (evita ler 1 milhão de linhas vazias)
        let maxRow = 0;
        for (let r = 1; r <= 3000; r++) {
            if (sheet['A' + r]) maxRow = r;
        }
        if (maxRow > 0) {
            sheet['!ref'] = 'A1:H' + (maxRow + 5);
        }

        const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
        if (rawRows.length < 4) {
            return res.status(400).json({ error: 'Planilha com formato inválido ou poucas linhas.' });
        }

        // Localizar a linha de cabeçalho exata (procura linha que contenha datas ou meses ou AGOSTO / SETEMBRO / PRODUTO)
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
            const r = rawRows[i] || [];
            const str = r.map(c => String(c || '').toUpperCase()).join(' ');
            if (str.includes('DEMANDAS') && (str.includes('AGOSTO') || str.includes('SETEMBRO') || str.includes('PREVIS'))) {
                headerRowIdx = i;
                break;
            }
            if (str.includes('PRODUTO') && str.includes('DESCRIC')) {
                headerRowIdx = i;
                break;
            }
        }
        if (headerRowIdx === -1) headerRowIdx = 3;

        // Se a linha 3 for "DEMANDAS" agrupadas e a linha 4 tiver os meses/datas, usamos a linha 4 para os nomes das colunas
        if (headerRowIdx < rawRows.length - 1) {
            const nextRowStr = (rawRows[headerRowIdx + 1] || []).map(c => String(c || '').toUpperCase()).join(' ');
            if (nextRowStr.includes('PRODUTO') || nextRowStr.includes('DESCRIC') || nextRowStr.includes('TOTAL')) {
                headerRowIdx = headerRowIdx + 1;
            }
        }

        const headerRow = rawRows[headerRowIdx] || [];
        
        // Identificar colunas de meses de demanda
        const monthCols = [];
        for (let c = 3; c < Math.min(headerRow.length, 15); c++) {
            const cellVal = headerRow[c];
            if (cellVal) {
                let monthLabel = '';
                if (cellVal instanceof Date) {
                    const m = cellVal.getUTCMonth() + 1;
                    const y = cellVal.getUTCFullYear();
                    const mNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                    monthLabel = `${mNames[m] || m}/${y}`;
                } else {
                    const s = String(cellVal).trim();
                    if (s.toLowerCase().includes('total')) break;
                    monthLabel = s;
                }
                if (monthLabel && !monthLabel.toLowerCase().includes('total') && !monthLabel.toLowerCase().includes('follow')) {
                    monthCols.push({ colIdx: c, label: monthLabel });
                }
            }
        }

        if (monthCols.length === 0) {
            monthCols.push(
                { colIdx: 3, label: 'Agosto' },
                { colIdx: 4, label: 'Setembro' },
                { colIdx: 5, label: 'Outubro' },
                { colIdx: 6, label: 'Novembro' }
            );
        }

        function cleanCode(str) {
            if (!str) return '';
            return String(str).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        }

        function getMonthGroup(dateVal) {
            if (!dateVal) return 'SEM DATA PCP';
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return 'SEM DATA PCP';
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            const mNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${mNames[m] || m}/${y}`;
        }

        // Extrair itens do Excel
        const excelItems = [];
        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;
            const refRaw = String(row[0] || '').trim();
            const descrRaw = String(row[1] || '').trim();
            if (!refRaw || refRaw.toUpperCase() === 'PRODUTO' || refRaw.toUpperCase().includes('TOTAL')) continue;

            const demandas = {};
            let totalDemanda = 0;
            monthCols.forEach(m => {
                const val = row[m.colIdx];
                const num = (typeof val === 'number') ? val : (val === '-' || !val ? 0 : parseFloat(val) || 0);
                demandas[m.label] = num;
                totalDemanda += num;
            });

            excelItems.push({
                refCliente: refRaw,
                refClean: cleanCode(refRaw),
                descricao: descrRaw,
                demandas,
                totalDemanda
            });
        }

        if (excelItems.length === 0) {
            return res.status(400).json({ error: 'Nenhum item com referência de cliente encontrado na planilha.' });
        }

        // Executar todas as consultas em paralelo no PostgreSQL e MySQL simultaneamente
        const [vmiMapRes, sz1Res, sc6Res, sc2Res, pcpRes] = await Promise.all([
            // 1. Carregar mapeamento VMI (app_demanda_vmi_map)
            mysqlPool.query('SELECT codigo_produto_cliente, b1_cod, descricao_protheus, z1_revisao FROM app_demanda_vmi_map')
                .catch(e => {
                    console.warn('[DEMANDA MÊS] Aviso ao ler app_demanda_vmi_map:', e.message);
                    return [[]];
                }),
            // 2. Carregar SZ1010 (De-Para Protheus)
            db.query(`
                SELECT TRIM(z1_codcli) as cod_cli,
                       TRIM(z1_produto) as b1_cod
                FROM public.sz1010
                WHERE COALESCE(d_e_l_e_t_, '') <> '*' AND TRIM(z1_produto) <> ''
            `),
            // 3. Carregar Pedidos em Aberto com Saldo no Protheus (SC6010)
            db.query(`
                SELECT TRIM(c6.c6_num) as pedido_metal,
                       TRIM(c6.c6_item) as item_pedido,
                       TRIM(c6.c6_pedcli) as pedido_cliente,
                       TRIM(c6.c6_produto) as cod_produto,
                       TRIM(c6.c6_descri) as desc_produto,
                       TRIM(c6.c6_xproc1) as ref_cliente,
                       TRIM(a1.a1_nome) as nome_cliente,
                       (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) as saldo_a_faturar,
                       c6.c6_entreg as data_entrega_protheus
                FROM public.sc6010 c6
                LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c6.c6_cli AND COALESCE(a1.d_e_l_e_t_, '') <> '*'
                WHERE (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) > 0
                  AND COALESCE(c6.d_e_l_e_t_, '') NOT IN ('*', '  *')
                  AND UPPER(a1.a1_nome) LIKE '%VMI SISTEMAS%'
            `),
            // 4. Carregar OPs do Protheus (SC2010)
            db.query(`
                SELECT TRIM(c2_pedido) as pedido,
                   TRIM(c2_itempv) as item,
                   TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen) as numero_op,
                   (COALESCE(c2_quant, 0) - COALESCE(c2_quje, 0)) as saldo_op
                FROM public.sc2010
                WHERE (COALESCE(c2_quant, 0) - COALESCE(c2_quje, 0)) > 0
                  AND COALESCE(d_e_l_e_t_, '') NOT IN ('*', '  *')
            `),
            // 5. Carregar Previsões PCP do SINCO (app_pcp_delivery_forecasts)
            mysqlPool.query(`
                SELECT TRIM(pedido) as pedido,
                       TRIM(item) as item,
                       TRIM(op_protheus) as op_protheus,
                       data_entrega_pcp,
                       quantidade_pcp
                FROM app_pcp_delivery_forecasts
                WHERE data_entrega_pcp IS NOT NULL
            `).catch(e => {
                console.warn('[DEMANDA MÊS] Aviso ao ler app_pcp_delivery_forecasts:', e.message);
                return [[]];
            })
        ]);

        // 1. Indexar De-Para VMI
        const vmiMapRows = vmiMapRes[0] || [];
        const vmiList = [];
        const vmiMap = new Map();
        for (const m of vmiMapRows) {
            const k = cleanCode(m.codigo_produto_cliente);
            if (k) {
                vmiMap.set(k, m.b1_cod);
                vmiList.push({ codCliClean: k, b1Cod: m.b1_cod });
            }
        }

        // 2. Indexar SZ1010 Protheus
        const sz1List = [];
        const sz1Map = new Map();
        for (const z of sz1Res.rows) {
            const k = cleanCode(z.cod_cli);
            if (k) {
                if (!sz1Map.has(k)) sz1Map.set(k, z.b1_cod);
                sz1List.push({ codCliClean: k, b1Cod: z.b1_cod });
            }
        }

        // 3. Indexar Pedidos Protheus (SC6010)
        const protheusByRef = new Map();
        const sc6List = [];
        for (const row of sc6Res.rows) {
            const refClean = cleanCode(row.ref_cliente);
            const prodClean = cleanCode(row.cod_produto);
            sc6List.push({ ...row, refClean, prodClean });

            const keys = [refClean, prodClean].filter(Boolean);
            for (const k of keys) {
                if (!protheusByRef.has(k)) protheusByRef.set(k, []);
                protheusByRef.get(k).push(row);
            }
        }

        // 4. Indexar OPs (SC2010)
        const opMap = new Map();
        for (const op of sc2Res.rows) {
            const k = `${op.pedido}|${op.item}`;
            if (!opMap.has(k)) opMap.set(k, []);
            opMap.get(k).push(op);
        }

        // 5. Indexar Previsões PCP (SINCO)
        const pcpRows = pcpRes[0] || [];
        const pcpMap = new Map();
        for (const p of pcpRows) {
            const k = `${p.pedido}|${p.item}`;
            if (!pcpMap.has(k)) pcpMap.set(k, []);
            pcpMap.get(k).push(p);
        }

        // 6. Montar o cruzamento completo
        let totalComSaldo = 0;
        let totalSemSaldo = 0;
        let totalSaldoGeral = 0;
        let totalDemandaGeral = 0;

        const resultadoCruzamento = excelItems.map(item => {
            const ref = item.refClean;

            // Rastrear b1_cod (Exato e Inteligente por prefixo/sufixo)
            let b1Cod = vmiMap.get(ref) || sz1Map.get(ref) || null;
            if (!b1Cod) {
                const vMatch = vmiList.find(m => m.codCliClean.endsWith(ref) || m.codCliClean.includes(ref));
                if (vMatch) b1Cod = vMatch.b1Cod;
            }
            if (!b1Cod) {
                const sMatch = sz1List.find(m => m.codCliClean.endsWith(ref) || m.codCliClean.includes(ref));
                if (sMatch) b1Cod = sMatch.b1Cod;
            }
            
            // Buscar pedidos vinculados no Protheus
            let matchedOrders = protheusByRef.get(ref) || [];
            if (matchedOrders.length === 0 && b1Cod) {
                matchedOrders = protheusByRef.get(cleanCode(b1Cod)) || [];
            }
            if (matchedOrders.length === 0) {
                const b1Clean = b1Cod ? cleanCode(b1Cod) : null;
                matchedOrders = sc6List.filter(o => {
                    if (b1Clean && o.prodClean === b1Clean) return true;
                    if (o.refClean && (o.refClean.endsWith(ref) || o.refClean.includes(ref))) return true;
                    return false;
                });
            }

            // Deduplicar pedidos encontrados
            const uniqueOrdersMap = new Map();
            for (const o of matchedOrders) {
                const k = `${o.pedido_metal}|${o.item_pedido}`;
                if (!uniqueOrdersMap.has(k)) uniqueOrdersMap.set(k, o);
            }
            const uniqueOrders = Array.from(uniqueOrdersMap.values());

            const hasBalance = uniqueOrders.length > 0;
            if (hasBalance) totalComSaldo++;
            else totalSemSaldo++;

            let saldoTotalItem = 0;
            const pcpPorMes = {};

            const pedidosDetalhados = uniqueOrders.map(o => {
                const saldo = Number(o.saldo_a_faturar) || 0;
                saldoTotalItem += saldo;
                if (!b1Cod) b1Cod = o.cod_produto;

                const ops = opMap.get(`${o.pedido_metal}|${o.item_pedido}`) || [];
                const pcps = pcpMap.get(`${o.pedido_metal}|${o.item_pedido}`) || [];

                if (pcps.length > 0) {
                    for (const fc of pcps) {
                        const mesGrp = getMonthGroup(fc.data_entrega_pcp);
                        const qtdPcp = parseFloat(fc.quantidade_pcp) || saldo;
                        pcpPorMes[mesGrp] = (pcpPorMes[mesGrp] || 0) + qtdPcp;
                    }
                } else {
                    pcpPorMes['SEM DATA PCP'] = (pcpPorMes['SEM DATA PCP'] || 0) + saldo;
                }

                return {
                    pedido_metal: o.pedido_metal,
                    item_pedido: o.item_pedido,
                    pedido_cliente: o.pedido_cliente,
                    cod_produto: o.cod_produto,
                    desc_produto: o.desc_produto,
                    nome_cliente: o.nome_cliente,
                    saldo_a_faturar: saldo,
                    ops: ops.map(op => ({
                        numero_op: op.numero_op,
                        saldo_op: Number(op.saldo_op) || 0
                    })),
                    previsoes_pcp: pcps.map(p => {
                        let dtStr = null;
                        if (p.data_entrega_pcp) {
                            try {
                                const dt = new Date(p.data_entrega_pcp);
                                if (!isNaN(dt.getTime())) {
                                    dtStr = dt.toISOString().split('T')[0];
                                } else {
                                    dtStr = String(p.data_entrega_pcp);
                                }
                            } catch {
                                dtStr = String(p.data_entrega_pcp);
                            }
                        }
                        return {
                            data_pcp: dtStr,
                            quantidade_pcp: parseFloat(p.quantidade_pcp) || saldo,
                            op_vinculada: p.op_protheus || 'SEM OP'
                        };
                    })
                };
            });

            totalSaldoGeral += saldoTotalItem;
            totalDemandaGeral += item.totalDemanda;

            return {
                ref_cliente: item.refCliente,
                codigo_metalfisa: b1Cod || (uniqueOrders[0]?.cod_produto) || 'NÃO MAPEADO',
                descricao: item.descricao || (uniqueOrders[0]?.desc_produto) || '',
                possui_saldo: hasBalance,
                total_saldo_faturar: saldoTotalItem,
                demandas: item.demandas,
                total_demanda: item.totalDemanda,
                pcp_por_mes: pcpPorMes,
                pedidos: pedidosDetalhados,
                presente_na_planilha: true
            };
        });

        // 7. Incluir todos os demais pedidos e itens VMI com saldo que NÃO estavam na planilha Excel
        const usedOrderKeys = new Set();
        resultadoCruzamento.forEach(it => {
            it.pedidos?.forEach(p => usedOrderKeys.add(`${p.pedido_metal}|${p.item_pedido}`));
        });

        const remainingOrders = sc6List.filter(o => !usedOrderKeys.has(`${o.pedido_metal}|${o.item_pedido}`));
        
        // Agrupar pedidos restantes por código de produto / ref
        const remainingGrouped = new Map();
        for (const o of remainingOrders) {
            const groupKey = o.cod_produto || o.ref_cliente || `${o.pedido_metal}|${o.item_pedido}`;
            if (!remainingGrouped.has(groupKey)) {
                remainingGrouped.set(groupKey, []);
            }
            remainingGrouped.get(groupKey).push(o);
        }

        const outrosItensVmi = [];
        for (const [groupKey, orders] of remainingGrouped.entries()) {
            let saldoTotalGrupo = 0;
            const pcpPorMes = {};

            const pedidosDetalhados = orders.map(o => {
                const saldo = Number(o.saldo_a_faturar) || 0;
                saldoTotalGrupo += saldo;

                const ops = opMap.get(`${o.pedido_metal}|${o.item_pedido}`) || [];
                const pcps = pcpMap.get(`${o.pedido_metal}|${o.item_pedido}`) || [];

                if (pcps.length > 0) {
                    for (const fc of pcps) {
                        const mesGrp = getMonthGroup(fc.data_entrega_pcp);
                        const qtdPcp = parseFloat(fc.quantidade_pcp) || saldo;
                        pcpPorMes[mesGrp] = (pcpPorMes[mesGrp] || 0) + qtdPcp;
                    }
                } else {
                    pcpPorMes['SEM DATA PCP'] = (pcpPorMes['SEM DATA PCP'] || 0) + saldo;
                }

                return {
                    pedido_metal: o.pedido_metal,
                    item_pedido: o.item_pedido,
                    pedido_cliente: o.pedido_cliente,
                    cod_produto: o.cod_produto,
                    desc_produto: o.desc_produto,
                    saldo_a_faturar: saldo,
                    ops: ops.map(op => ({
                        numero_op: op.numero_op,
                        saldo_op: Number(op.saldo_op) || 0
                    })),
                    previsoes_pcp: pcps.map(p => {
                        let dtStr = null;
                        if (p.data_entrega_pcp) {
                            try {
                                const dt = new Date(p.data_entrega_pcp);
                                if (!isNaN(dt.getTime())) {
                                    dtStr = dt.toISOString().split('T')[0];
                                } else {
                                    dtStr = String(p.data_entrega_pcp);
                                }
                            } catch {
                                dtStr = String(p.data_entrega_pcp);
                            }
                        }
                        return {
                            data_pcp: dtStr,
                            quantidade_pcp: parseFloat(p.quantidade_pcp) || saldo,
                            op_vinculada: p.op_protheus || 'SEM OP'
                        };
                    })
                };
            });

            totalSaldoGeral += saldoTotalGrupo;
            totalComSaldo++;

            outrosItensVmi.push({
                ref_cliente: orders[0]?.ref_cliente || 'VMI GERAL',
                codigo_metalfisa: orders[0]?.cod_produto || 'NÃO MAPEADO',
                descricao: orders[0]?.desc_produto || '',
                possui_saldo: true,
                total_saldo_faturar: saldoTotalGrupo,
                demandas: {}, // Sem demanda na planilha
                total_demanda: 0,
                pcp_por_mes: pcpPorMes,
                pedidos: pedidosDetalhados,
                presente_na_planilha: false
            });
        }

        const listaFinalItens = [...resultadoCruzamento, ...outrosItensVmi];

        res.json({
            success: true,
            sheetName,
            mesesDemanda: monthCols.map(m => m.label),
            totais: {
                totalItens: listaFinalItens.length,
                totalItensPlanilha: excelItems.length,
                totalItensForaPlanilha: outrosItensVmi.length,
                totalComSaldo,
                totalSemSaldo,
                totalSaldoGeral,
                totalDemandaGeral
            },
            itens: listaFinalItens
        });

    } catch (err) {
        console.error('[DEMANDA MÊS PROCESSAR]', err);
        res.status(500).json({ error: 'Erro ao processar planilha de demanda: ' + err.message });
    }
});


