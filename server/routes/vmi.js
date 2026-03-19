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

        if (!jsonData || jsonData.length < 2) {
            return res.status(400).json({ error: 'Planilha vazia ou sem dados.' });
        }

        const headers = jsonData[0];

        // ── Validação do modelo ──────────────────────────────────────────────
        const missingCols = [];
        MODELO_COLUNAS_FIXAS.forEach((expected, i) => {
            const actual = String(headers[i] || '').trim();
            if (actual.toLowerCase() !== expected.toLowerCase()) {
                missingCols.push(`Coluna ${i + 1}: esperado "${expected}", encontrado "${actual || '(vazio)'}"`);
            }
        });
        if (missingCols.length > 0) {
            return res.status(400).json({
                error: `Planilha fora do modelo esperado. Baixe o modelo correto e preencha novamente.\n\nDiferenças encontradas:\n• ${missingCols.join('\n• ')}`,
                modelo_invalido: true
            });
        }

        // Da coluna F (index 5) em diante são os meses / semanas de demanda
        const months = headers.slice(5).filter(h => h && h.trim().length > 0);
        if (months.length === 0) {
            return res.status(400).json({ error: 'Nenhuma coluna de quantidade/mês detectada a partir da coluna F (Col 6).' });
        }

        const loteId = uuidv4();
        let previewRows = [];

        let lastOrdem = '';
        let lastPai = '';
        let lastEquip = '';

        // Ignorando header (0) iterando do 1
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];

            if (!row || !Array.isArray(row) || row.length === 0) continue;

            // Se veio preenchido, salva como o último lido (trata células mescladas)
            if (row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== '') {
                lastOrdem = String(row[0]).trim();
                lastPai = String(row[1] || '').trim();
                lastEquip = String(row[2] || '').trim();
            }

            // Se ainda não temos uma ordem lida, pula
            if (!lastOrdem) continue;

            const ordem_compra_cliente = lastOrdem;
            const produto_pai = lastPai;
            const descricao_equipamento = lastEquip;
            const codigo_produto_cliente = String(row[3] || '').trim();
            const descricao_produto_cliente = String(row[4] || '').trim();
            const rev_cliente = ''; // Removido pois F (5) agora é o primeiro mês de demanda

            // Pula se for linha vazia ou só título do grupo sem produtos filhos
            if (!codigo_produto_cliente && !descricao_produto_cliente) continue;

            let mesesQtd = {};
            let hasDemand = false;

            for (let j = 0; j < months.length; j++) {
                const mes = String(months[j]).trim();
                const colIndex = 5 + j; // Ajustade para iniciar da coluna F
                let rawVal = row[colIndex];

                if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') continue;

                if (typeof rawVal === 'string') {
                    // Aceita "1.234,50" -> "1234.50" e "1,5" -> "1.5"
                    rawVal = rawVal.replace(/\./g, '').replace(',', '.');
                }

                const qtd = Number(rawVal);

                // Salva apenas se for número e maior que 0
                if (!isNaN(qtd) && qtd > 0) {
                    mesesQtd[mes] = qtd;
                    hasDemand = true;
                }
            }

            if (hasDemand) {
                previewRows.push({
                    ordem_compra_cliente,
                    produto_pai,
                    descricao_equipamento,
                    codigo_produto_cliente,
                    descricao_produto_cliente,
                    rev_cliente,
                    meses: mesesQtd
                });
            }
        }

        if (previewRows.length === 0) {
            return res.status(400).json({ error: 'Nenhum dado válido para importar. Todas as quantidades numéricas estão zeradas ou arquivo está com formatação errada.' });
        }

        // Return preview data without DB insertion
        res.json({
            success: true,
            msg: `Planilha lida com sucesso. Encontradas ${previewRows.length} linhas de demanda no lote de ${months.join(', ')}.`,
            preview_data: previewRows,
            meses: months,
            _import_meta: {
                nome_arquivo: fileName,
                hash_conteudo: fileHash,
                sheet_name: sheetName,
                total_linhas: previewRows.length,
                meses: months
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
                    now // Added created_at
                ]);
            }
        });

        // Bulk insert em chunks para não estourar a memória (max 1000 param sets no Mysql)
        const CHUNK_SIZE = 500;
        let insertedRows = 0;

        for (let i = 0; i < pushParams.length; i += CHUNK_SIZE) {
            const chunk = pushParams.slice(i, i + CHUNK_SIZE);
            const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(','); // 10 placeholders
            const flatParams = chunk.flat();

            await mysqlPool.execute(`
                INSERT INTO app_demanda_vmi (
                    lote_importacao, ordem_compra_cliente, produto_pai, descricao_equipamento,
                    codigo_produto_cliente, descricao_produto_cliente, rev_cliente,
                    mes_referencia, quantidade, created_at
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
                id, lote_importacao, ordem_compra_cliente, produto_pai,
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

module.exports = router;
