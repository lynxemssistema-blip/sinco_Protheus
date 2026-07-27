const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const db = require('../db'); // Protheus PG connection
const { emitHermesAlert } = require('../services/hermes/proactiveCron');

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const round3 = (n) => Math.round(n * 1000) / 1000;

const computeSituacao = ({ prevista, produzida }) => {
    if (prevista > 0 && produzida >= prevista) return 'CONCLUIDO';
    if (produzida > 0) return 'EM_ANDAMENTO';
    return 'PENDENTE';
};

const normalizeTipoDesenho = (value) => String(value || '').trim().toUpperCase();

const isMaterialTipo = (tipo) => normalizeTipoDesenho(tipo) === 'MATERIAL';

const isSituacaoConcluida = (situacao) => {
    const s = String(situacao || '').trim().toUpperCase();
    return s === 'CONCLUIDO' || s === 'CONCLUÍDO' || s === 'FINALIZADO';
};

/**
 * Tabela de controle de entrega de materiais (OS)
 * - Mantém o estado atual (solicitado/chegou/entregue) por Item da OS
 */
const initOsMaterialEntregaTable = async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_os_material_entregas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                os_id INT NOT NULL,
                os_item_id INT NOT NULL,
                cod_mat_fabricante VARCHAR(200) NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'NAO_SOLICITADO',
                solicitado_em DATETIME NULL,
                solicitado_por VARCHAR(200) NULL,
                chegada_prevista_em DATE NULL,
                chegada_em DATETIME NULL,
                recebido_por VARCHAR(200) NULL,
                entregue_em DATETIME NULL,
                entregue_por VARCHAR(200) NULL,
                entregue_para VARCHAR(200) NULL,
                observacao TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY ux_os_item (os_id, os_item_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ [SINCO APONTAMENTO] Tabela app_os_material_entregas verificada/criada.');
    } catch (err) {
        console.error('❌ [SINCO APONTAMENTO] Erro ao criar/verificar app_os_material_entregas:', err.message);
    }
};

initOsMaterialEntregaTable();

// GET /api/sinco-apontamento/os/:osId/items
// Retorna itens da OS enriquecidos com EnderecoArquivo da tabela material (por CodMatFabricante)
router.get('/os/:osId/items', async (req, res) => {
    try {
        const { osId } = req.params; // IdOrdemServico

        const [rows] = await mysqlPool.query(
            `
            SELECT
                i.IdOrdemServico,
                i.IdOrdemServicoItem,
                i.Nivel,
                i.CodMatFabricante,
                i.Projeto,
                i.Tag,
                i.txtTipoDesenho,
                i.DescResumo,
                i.QtdeTotal,
                i.qtde,
                i.Unidade,
                i.ProdutoPrincipal,
                i.OrdemServicoItemFinalizado,
                i.DataFinalizado,
                i.UsuarioFinalizado,
                i.EnderecoArquivo AS EnderecoArquivoOS,
                m.EnderecoArquivo AS EnderecoArquivoMaterial,

                COALESCE(pp.total_processos, 0) AS TotalProcessos,
                COALESCE(pp.processos_concluidos, 0) AS ProcessosConcluidos,
                CASE
                    WHEN i.OrdemServicoItemFinalizado = 'S' THEN 'CONCLUIDO'
                    WHEN COALESCE(pp.total_processos, 0) > 0 AND COALESCE(pp.processos_concluidos, 0) = COALESCE(pp.total_processos, 0) THEN 'CONCLUIDO'
                    WHEN COALESCE(pp.processos_concluidos, 0) > 0 THEN 'EM_ANDAMENTO'
                    ELSE 'PENDENTE'
                END AS ItemStatus,

                e.status AS EntregaStatus,
                e.solicitado_em AS EntregaSolicitadoEm,
                e.solicitado_por AS EntregaSolicitadoPor,
                e.chegada_prevista_em AS EntregaChegadaPrevistaEm,
                e.chegada_em AS EntregaChegadaEm,
                e.recebido_por AS EntregaRecebidoPor,
                e.entregue_em AS EntregaEntregueEm,
                e.entregue_por AS EntregaEntreguePor,
                e.entregue_para AS EntregaEntreguePara,
                e.observacao AS EntregaObservacao
            FROM ordemservicoitem i
            LEFT JOIN material m
                ON UPPER(TRIM(m.CodMatFabricante)) = UPPER(TRIM(i.CodMatFabricante))
            LEFT JOIN (
                SELECT
                    p.IdOrdemServicoItem,
                    COUNT(*) AS total_processos,
                    SUM(CASE WHEN UPPER(TRIM(COALESCE(p.Situacao, ''))) IN ('CONCLUIDO', 'CONCLUÍDO', 'FINALIZADO') THEN 1 ELSE 0 END) AS processos_concluidos
                FROM ordemservicoitem_processo p
                GROUP BY p.IdOrdemServicoItem
            ) pp
                ON pp.IdOrdemServicoItem = i.IdOrdemServicoItem
            LEFT JOIN app_os_material_entregas e
                ON e.os_id = i.IdOrdemServico AND e.os_item_id = i.IdOrdemServicoItem
            WHERE i.IdOrdemServico = ?
            ORDER BY i.IdOrdemServicoItem ASC
            `,
            [osId]
        );

        res.json(rows);
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar itens enriquecidos da OS:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar itens da OS' });
    }
});

// GET /api/sinco-apontamento/os/:osId/matrix  (osId pode ser "all" para buscar em todas as OS)
// Retorna matriz (itens x processos) para apontamento em tela estilo "Matriz de Produção"
router.get('/os/:osId/matrix', async (req, res) => {
    try {
        const { osId } = req.params; // IdOrdemServico ou "all"
        const { q, projeto, tag } = req.query || {};

        const isAll = !osId || osId === 'all';

        // Exige pelo menos um filtro quando buscando em todas as OS
        if (isAll && !q && !projeto && !tag) {
            return res.status(400).json({ error: 'Informe ao menos um filtro (Filtro, Projeto ou Tag) para buscar em todas as OS.' });
        }

        const params = [];
        let whereClause = '';

        if (!isAll) {
            whereClause += 'WHERE i.IdOrdemServico = ?';
            params.push(osId);
        } else {
            whereClause += 'WHERE 1=1';
        }

        if (q) {
            whereClause += ' AND (i.CodMatFabricante LIKE ? OR i.DescResumo LIKE ?)';
            params.push(`%${q}%`, `%${q}%`);
        }
        if (projeto) {
            whereClause += ' AND i.Projeto LIKE ?';
            params.push(`%${projeto}%`);
        }
        if (tag) {
            whereClause += ' AND i.Tag LIKE ?';
            params.push(`%${tag}%`);
        }

        const [rows] = await mysqlPool.query(
            `
            SELECT
                i.IdOrdemServico,
                i.IdOrdemServicoItem,
                i.Nivel,
                i.CodMatFabricante,
                i.Projeto,
                i.Tag,
                i.txtTipoDesenho,
                i.DescResumo,
                i.QtdeTotal,
                i.qtde,
                i.Unidade,
                i.ProdutoPrincipal,
                i.OrdemServicoItemFinalizado,
                i.DataFinalizado,
                i.UsuarioFinalizado,
                i.EnderecoArquivo AS EnderecoArquivoOS,
                m.EnderecoArquivo AS EnderecoArquivoMaterial,

                e.status AS EntregaStatus,
                e.solicitado_em AS EntregaSolicitadoEm,
                e.solicitado_por AS EntregaSolicitadoPor,
                e.chegada_prevista_em AS EntregaChegadaPrevistaEm,
                e.chegada_em AS EntregaChegadaEm,
                e.recebido_por AS EntregaRecebidoPor,
                e.entregue_em AS EntregaEntregueEm,
                e.entregue_por AS EntregaEntreguePor,
                e.entregue_para AS EntregaEntreguePara,
                e.observacao AS EntregaObservacao,

                p.IdOSItemProcesso,
                p.IdProcesso,
                p.SequenciaExecucao,
                p.QtdePrevista,
                p.QtdeProduzida,
                p.Situacao,
                p.DataPlanejadaInicio,
                p.DataPlanejadaFim,
                p.DataInicio,
                p.DataFim,
                p.UsuarioInicio,
                p.UsuarioFim,
                p.Observacao,
                f.processofabricacao AS NomeProcesso,
                f.CodigoProcessoFabricacao
            FROM ordemservicoitem i
            LEFT JOIN material m
                ON UPPER(TRIM(m.CodMatFabricante)) = UPPER(TRIM(i.CodMatFabricante))
            LEFT JOIN app_os_material_entregas e
                ON e.os_id = i.IdOrdemServico AND e.os_item_id = i.IdOrdemServicoItem
            LEFT JOIN ordemservicoitem_processo p
                ON p.IdOrdemServicoItem = i.IdOrdemServicoItem
            LEFT JOIN processofabricacao f
                ON f.IdProcessoFabricacao = p.IdProcesso
            ${whereClause}
            ORDER BY i.IdOrdemServico ASC, i.IdOrdemServicoItem ASC, p.SequenciaExecucao ASC, p.IdOSItemProcesso ASC
            `,
            params
        );

        const operationsMap = new Map();
        const itemsMap = new Map();

        for (const r of rows) {
            const itemId = r.IdOrdemServicoItem;
            if (!itemsMap.has(itemId)) {
                itemsMap.set(itemId, {
                    IdOrdemServico: r.IdOrdemServico,
                    IdOrdemServicoItem: r.IdOrdemServicoItem,
                    Nivel: r.Nivel,
                    CodMatFabricante: r.CodMatFabricante,
                    Projeto: r.Projeto,
                    Tag: r.Tag,
                    txtTipoDesenho: r.txtTipoDesenho,
                    DescResumo: r.DescResumo,
                    QtdeTotal: r.QtdeTotal,
                    qtde: r.qtde,
                    Unidade: r.Unidade,
                    ProdutoPrincipal: r.ProdutoPrincipal,
                    OrdemServicoItemFinalizado: r.OrdemServicoItemFinalizado,
                    DataFinalizado: r.DataFinalizado,
                    UsuarioFinalizado: r.UsuarioFinalizado,
                    EnderecoArquivoOS: r.EnderecoArquivoOS,
                    EnderecoArquivoMaterial: r.EnderecoArquivoMaterial,

                    EntregaStatus: r.EntregaStatus,
                    EntregaSolicitadoEm: r.EntregaSolicitadoEm,
                    EntregaSolicitadoPor: r.EntregaSolicitadoPor,
                    EntregaChegadaPrevistaEm: r.EntregaChegadaPrevistaEm,
                    EntregaChegadaEm: r.EntregaChegadaEm,
                    EntregaRecebidoPor: r.EntregaRecebidoPor,
                    EntregaEntregueEm: r.EntregaEntregueEm,
                    EntregaEntreguePor: r.EntregaEntreguePor,
                    EntregaEntreguePara: r.EntregaEntreguePara,
                    EntregaObservacao: r.EntregaObservacao,

                    operations: {},
                    TotalProcessos: 0,
                    ProcessosConcluidos: 0,
                    ItemStatus: 'PENDENTE'
                });
            }

            // Row pode vir sem processo (LEFT JOIN)
            if (!r.IdOSItemProcesso) continue;

            const opKey = String(r.CodigoProcessoFabricacao || r.IdProcesso || '').trim() || String(r.IdOSItemProcesso);
            const sequencia = toNumber(r.SequenciaExecucao);

            if (!operationsMap.has(opKey)) {
                operationsMap.set(opKey, {
                    key: opKey,
                    code: r.CodigoProcessoFabricacao ? String(r.CodigoProcessoFabricacao).trim() : opKey,
                    name: r.NomeProcesso || null,
                    sequencia
                });
            } else {
                // manter a menor sequência conhecida (ordenação consistente)
                const cur = operationsMap.get(opKey);
                if (cur && (cur.sequencia === 0 || (sequencia > 0 && sequencia < cur.sequencia))) {
                    operationsMap.set(opKey, { ...cur, sequencia });
                }
            }

            const item = itemsMap.get(itemId);
            const prevista = toNumber(r.QtdePrevista);
            const produzida = toNumber(r.QtdeProduzida);
            const percentual = prevista > 0 ? Math.min(100, Math.round((produzida / prevista) * 100)) : (produzida > 0 ? 100 : 0);

            const done = isSituacaoConcluida(r.Situacao) || (prevista > 0 && produzida >= prevista);
            const status = done ? 'done' : (produzida > 0 ? 'in_progress' : 'pending');

            item.operations[opKey] = {
                id: r.IdOSItemProcesso,
                id_processo: r.IdProcesso,
                sequencia: sequencia,
                situacao: r.Situacao,
                qtd_planejada: prevista,
                qtd_produzida: produzida,
                percentual,
                status,
                nome_processo: r.NomeProcesso || null,
                codigo_processo: r.CodigoProcessoFabricacao || null,
                dates: {
                    plan_start: r.DataPlanejadaInicio || null,
                    plan_end: r.DataPlanejadaFim || null,
                    start: r.DataInicio || null,
                    end: r.DataFim || null
                }
            };
        }

        const operations = Array.from(operationsMap.values())
            .sort((a, b) => (toNumber(a.sequencia) - toNumber(b.sequencia)) || String(a.code).localeCompare(String(b.code)));

        const items = Array.from(itemsMap.values()).map(item => {
            const ops = Object.values(item.operations || {});
            const total = ops.length;
            const concluidos = ops.filter(o => o.status === 'done').length;

            item.TotalProcessos = total;
            item.ProcessosConcluidos = concluidos;

            if (String(item.OrdemServicoItemFinalizado || '').toUpperCase() === 'S') {
                item.ItemStatus = 'CONCLUIDO';
            } else if (total > 0 && concluidos === total) {
                item.ItemStatus = 'CONCLUIDO';
            } else if (ops.some(o => o.status !== 'pending')) {
                item.ItemStatus = 'EM_ANDAMENTO';
            } else {
                item.ItemStatus = 'PENDENTE';
            }

            return item;
        });

        res.json({ operations, items });
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar matriz da OS:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar matriz da OS' });
    }
});

// GET /api/sinco-apontamento/os/:osId/materials
// Retorna apenas itens do tipo "MATERIAL" (controle de entrega + desenho)
router.get('/os/:osId/materials', async (req, res) => {
    try {
        const { osId } = req.params; // IdOrdemServico
        const { q } = req.query || {};

        const params = [osId];
        let extraWhere = '';
        if (q) {
            extraWhere = ' AND (i.CodMatFabricante LIKE ? OR i.DescResumo LIKE ?)';
            params.push(`%${q}%`, `%${q}%`);
        }

        const [rows] = await mysqlPool.query(
            `
            SELECT
                i.IdOrdemServico,
                i.IdOrdemServicoItem,
                i.Nivel,
                i.CodMatFabricante, i.Projeto, i.Tag,
                i.txtTipoDesenho,
                i.DescResumo,
                i.QtdeTotal,
                i.qtde,
                i.Fator,
                i.Unidade,
                i.ProdutoPrincipal,
                i.OrdemServicoItemFinalizado,
                i.DataFinalizado,
                i.UsuarioFinalizado,
                i.EnderecoArquivo AS EnderecoArquivoOS,
                m.EnderecoArquivo AS EnderecoArquivoMaterial,

                e.status AS EntregaStatus,
                e.solicitado_em AS EntregaSolicitadoEm,
                e.solicitado_por AS EntregaSolicitadoPor,
                e.chegada_prevista_em AS EntregaChegadaPrevistaEm,
                e.chegada_em AS EntregaChegadaEm,
                e.recebido_por AS EntregaRecebidoPor,
                e.entregue_em AS EntregaEntregueEm,
                e.entregue_por AS EntregaEntreguePor,
                e.entregue_para AS EntregaEntreguePara,
                e.observacao AS EntregaObservacao
            FROM ordemservicoitem i
            LEFT JOIN material m
                ON UPPER(TRIM(m.CodMatFabricante)) = UPPER(TRIM(i.CodMatFabricante))
            LEFT JOIN app_os_material_entregas e
                ON e.os_id = i.IdOrdemServico AND e.os_item_id = i.IdOrdemServicoItem
            WHERE i.IdOrdemServico = ?
              AND UPPER(TRIM(COALESCE(i.txtTipoDesenho, ''))) = 'MATERIAL'
            ${extraWhere}
            ORDER BY i.Nivel ASC, i.IdOrdemServicoItem ASC
            `,
            params
        );

        res.json(rows);
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar materiais da OS:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar materiais da OS' });
    }
});

// GET /api/sinco-apontamento/items/:id/material-entrega
router.get('/items/:id/material-entrega', async (req, res) => {
    try {
        const { id } = req.params; // IdOrdemServicoItem
        const [rows] = await mysqlPool.query(
            `
            SELECT *
            FROM app_os_material_entregas
            WHERE os_item_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [id]
        );
        res.json(rows[0] || null);
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar entrega do material:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar entrega do material' });
    }
});

// POST /api/sinco-apontamento/items/:id/material-entrega/solicitar
router.post('/items/:id/material-entrega/solicitar', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id } = req.params; // IdOrdemServicoItem
        const { usuario, chegada_prevista_em, observacao } = req.body || {};

        if (!usuario) return res.status(400).json({ error: 'Campo "usuario" é obrigatório.' });

        await connection.beginTransaction();

        const [itemRows] = await connection.query(
            `
            SELECT
                IdOrdemServico,
                IdOrdemServicoItem,
                CodMatFabricante,
                txtTipoDesenho
            FROM ordemservicoitem
            WHERE IdOrdemServicoItem = ?
            LIMIT 1
            `,
            [id]
        );

        if (!itemRows || itemRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Item da OS não encontrado.' });
        }

        const item = itemRows[0];
        if (!isMaterialTipo(item.txtTipoDesenho)) {
            await connection.rollback();
            return res.status(400).json({ error: 'Este item não é do tipo MATERIAL.' });
        }

        await connection.query(
            `
            INSERT INTO app_os_material_entregas
            (os_id, os_item_id, cod_mat_fabricante, status, solicitado_em, solicitado_por, chegada_prevista_em, observacao)
            VALUES (?, ?, ?, 'SOLICITADO', NOW(), ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                cod_mat_fabricante = VALUES(cod_mat_fabricante),
                status = 'SOLICITADO',
                solicitado_em = NOW(),
                solicitado_por = VALUES(solicitado_por),
                chegada_prevista_em = COALESCE(VALUES(chegada_prevista_em), chegada_prevista_em),
                observacao = COALESCE(VALUES(observacao), observacao)
            `,
            [
                item.IdOrdemServico,
                item.IdOrdemServicoItem,
                item.CodMatFabricante || null,
                usuario,
                chegada_prevista_em || null,
                observacao || null
            ]
        );

        const [rows] = await connection.query(
            `SELECT * FROM app_os_material_entregas WHERE os_id = ? AND os_item_id = ? LIMIT 1`,
            [item.IdOrdemServico, item.IdOrdemServicoItem]
        );

        await connection.commit();
        res.json({ success: true, entrega: rows[0] || null });
    } catch (error) {
        try { await connection.rollback(); } catch { }
        console.error('[SINCO APONTAMENTO] Erro ao solicitar material:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao solicitar material' });
    } finally {
        connection.release();
    }
});

// POST /api/sinco-apontamento/items/:id/material-entrega/chegada
router.post('/items/:id/material-entrega/chegada', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id } = req.params; // IdOrdemServicoItem
        const { usuario, observacao } = req.body || {};

        if (!usuario) return res.status(400).json({ error: 'Campo "usuario" é obrigatório.' });

        await connection.beginTransaction();

        const [itemRows] = await connection.query(
            `
            SELECT
                IdOrdemServico,
                IdOrdemServicoItem,
                CodMatFabricante,
                txtTipoDesenho
            FROM ordemservicoitem
            WHERE IdOrdemServicoItem = ?
            LIMIT 1
            `,
            [id]
        );

        if (!itemRows || itemRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Item da OS não encontrado.' });
        }

        const item = itemRows[0];
        if (!isMaterialTipo(item.txtTipoDesenho)) {
            await connection.rollback();
            return res.status(400).json({ error: 'Este item não é do tipo MATERIAL.' });
        }

        await connection.query(
            `
            INSERT INTO app_os_material_entregas
            (os_id, os_item_id, cod_mat_fabricante, status, chegada_em, recebido_por, observacao)
            VALUES (?, ?, ?, 'CHEGOU', NOW(), ?, ?)
            ON DUPLICATE KEY UPDATE
                cod_mat_fabricante = VALUES(cod_mat_fabricante),
                status = 'CHEGOU',
                chegada_em = NOW(),
                recebido_por = VALUES(recebido_por),
                observacao = COALESCE(VALUES(observacao), observacao)
            `,
            [
                item.IdOrdemServico,
                item.IdOrdemServicoItem,
                item.CodMatFabricante || null,
                usuario,
                observacao || null
            ]
        );

        const [rows] = await connection.query(
            `SELECT * FROM app_os_material_entregas WHERE os_id = ? AND os_item_id = ? LIMIT 1`,
            [item.IdOrdemServico, item.IdOrdemServicoItem]
        );

        await connection.commit();
        res.json({ success: true, entrega: rows[0] || null });
    } catch (error) {
        try { await connection.rollback(); } catch { }
        console.error('[SINCO APONTAMENTO] Erro ao marcar chegada do material:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao marcar chegada do material' });
    } finally {
        connection.release();
    }
});

// POST /api/sinco-apontamento/items/:id/material-entrega/entregar
router.post('/items/:id/material-entrega/entregar', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id } = req.params; // IdOrdemServicoItem
        const { usuario, entregue_para, observacao } = req.body || {};

        if (!usuario) return res.status(400).json({ error: 'Campo "usuario" é obrigatório.' });
        if (!entregue_para) return res.status(400).json({ error: 'Campo "entregue_para" é obrigatório.' });

        await connection.beginTransaction();

        const [itemRows] = await connection.query(
            `
            SELECT
                IdOrdemServico,
                IdOrdemServicoItem,
                CodMatFabricante,
                txtTipoDesenho
            FROM ordemservicoitem
            WHERE IdOrdemServicoItem = ?
            LIMIT 1
            `,
            [id]
        );

        if (!itemRows || itemRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Item da OS não encontrado.' });
        }

        const item = itemRows[0];
        if (!isMaterialTipo(item.txtTipoDesenho)) {
            await connection.rollback();
            return res.status(400).json({ error: 'Este item não é do tipo MATERIAL.' });
        }

        await connection.query(
            `
            INSERT INTO app_os_material_entregas
            (os_id, os_item_id, cod_mat_fabricante, status, entregue_em, entregue_por, entregue_para, observacao)
            VALUES (?, ?, ?, 'ENTREGUE', NOW(), ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                cod_mat_fabricante = VALUES(cod_mat_fabricante),
                status = 'ENTREGUE',
                entregue_em = NOW(),
                entregue_por = VALUES(entregue_por),
                entregue_para = VALUES(entregue_para),
                observacao = COALESCE(VALUES(observacao), observacao)
            `,
            [
                item.IdOrdemServico,
                item.IdOrdemServicoItem,
                item.CodMatFabricante || null,
                usuario,
                entregue_para,
                observacao || null
            ]
        );

        const [rows] = await connection.query(
            `SELECT * FROM app_os_material_entregas WHERE os_id = ? AND os_item_id = ? LIMIT 1`,
            [item.IdOrdemServico, item.IdOrdemServicoItem]
        );

        await connection.commit();
        res.json({ success: true, entrega: rows[0] || null });
    } catch (error) {
        try { await connection.rollback(); } catch { }
        console.error('[SINCO APONTAMENTO] Erro ao entregar material:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao entregar material' });
    } finally {
        connection.release();
    }
});

// GET /api/sinco-apontamento/processos-list
// Retorna a lista de todos os processos disponíveis
router.get('/processos-list', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            `SELECT IdProcessoFabricacao as IdProcesso, processofabricacao as Descricao, CodigoProcessoFabricacao as Codigo FROM processofabricacao ORDER BY CodigoProcessoFabricacao ASC`
        );
        res.json(rows);
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar lista de processos:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar lista de processos' });
    }
});

// GET /api/sinco-apontamento/items/:id/processos
router.get('/items/:id/processos', async (req, res) => {
    try {
        const { id } = req.params; // IdOrdemServicoItem
        const [rows] = await mysqlPool.query(
            `
            SELECT
                p.IdOSItemProcesso,
                p.IdOrdemServicoItem,
                p.IdProcesso,
                p.SequenciaExecucao,
                p.QtdePrevista,
                p.QtdeProduzida,
                p.Situacao,
                p.DataPlanejadaInicio,
                p.DataPlanejadaFim,
                p.DataInicio,
                p.DataFim,
                p.UsuarioInicio,
                p.UsuarioFim,
                p.Observacao,
                f.processofabricacao AS NomeProcesso,
                f.CodigoProcessoFabricacao
            FROM ordemservicoitem_processo p
            LEFT JOIN processofabricacao f ON f.IdProcessoFabricacao = p.IdProcesso
            WHERE p.IdOrdemServicoItem = ?
            ORDER BY p.SequenciaExecucao ASC, p.IdOSItemProcesso ASC
            `,
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar processos do item:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar processos do item' });
    }
});

// GET /api/sinco-apontamento/processos/:id/historico
router.get('/processos/:id/historico', async (req, res) => {
    try {
        const { id } = req.params; // IdOSItemProcesso
        const [rows] = await mysqlPool.query(
            `
            SELECT *
            FROM ordemservicoitemcontrole
            WHERE IdOSItemProcesso = ?
              AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E = '')
            ORDER BY DataCriacao DESC, IdOrdemServicoItemControle DESC
            LIMIT 200
            `,
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar histórico do processo:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar histórico do processo' });
    }
});

// POST /api/sinco-apontamento/processos/:id/apontar
// Registra um apontamento no histórico e atualiza o acumulado do processo do item.
router.post('/processos/:id/apontar', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id } = req.params; // IdOSItemProcesso
        const { usuario, quantidade, observacao, finalizar = false } = req.body || {};

        if (!usuario) return res.status(400).json({ error: 'Campo "usuario" é obrigatório.' });

        const qtd = toNumber(quantidade);
        if (!Number.isFinite(qtd) || qtd <= 0) {
            return res.status(400).json({ error: 'Campo "quantidade" deve ser um número maior que 0.' });
        }

        await connection.beginTransaction();

        let companyConfig = {};
        try {
            const [configRows] = await connection.query(`SELECT general_config FROM app_company_settings WHERE id = 1 LIMIT 1`);
            if (configRows.length > 0 && configRows[0].general_config) {
                companyConfig = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
            }
        } catch (e) {
            console.error('Erro ao buscar config da empresa:', e);
        }

        // ------------------------------------------------------------------------------------------
        // [SGQ - GESTÃO DE ATIVOS] - BLOQUEIO DE CALIBRAÇÃO VENCIDA
        // ------------------------------------------------------------------------------------------
        try {
            const sgqActive = String(companyConfig.sgq_module_active) === 'true';

            if (sgqActive) {
                const [userCheck] = await connection.query(`SELECT idUsuario FROM usuario WHERE Login = ? LIMIT 1`, [usuario]);
                if (userCheck.length > 0) {
                    const idUsuario = userCheck[0].idUsuario;
                    const [expiredAssets] = await connection.query(`
                        SELECT a.name, a.patrimonio 
                        FROM sgq_assets a
                        JOIN sgq_asset_toolbox t ON a.id = t.asset_id
                        JOIN sgq_toolboxes tb ON t.toolbox_id = tb.id
                        WHERE tb.employee_cpf = ?
                          AND a.calibration_next_date IS NOT NULL 
                          AND a.calibration_next_date < CURDATE()
                    `, [idUsuario]);

                    if (expiredAssets && expiredAssets.length > 0) {
                        const expiredNames = expiredAssets.map(a => a.name).join(', ');
                        await connection.rollback();
                        return res.status(403).json({ 
                            error: `[SGQ] Apontamento bloqueado: Você possui instrumentos com calibração vencida (${expiredNames}). Procure a Qualidade para regularizar.` 
                        });
                    }
                }
            }
        } catch (sgqError) {
            console.error('[SGQ BLOQUEIO] Erro ao verificar calibração:', sgqError);
            // Non-blocking error, we log and continue if SGQ check fails
        }
        // ------------------------------------------------------------------------------------------

        const [procRows] = await connection.query(
            `
            SELECT
                p.IdOSItemProcesso,
                p.IdOrdemServicoItem,
                p.IdProcesso,
                p.SequenciaExecucao,
                p.QtdePrevista,
                p.QtdeProduzida,
                p.Situacao,
                p.DataInicio,
                p.DataFim,
                p.UsuarioInicio,
                p.UsuarioFim
            FROM ordemservicoitem_processo p
            WHERE p.IdOSItemProcesso = ?
            FOR UPDATE
            `,
            [id]
        );

        if (!procRows || procRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Processo não encontrado.' });
        }

        const proc = procRows[0];
        const prevista = toNumber(proc.QtdePrevista);
        const produzidaAtual = toNumber(proc.QtdeProduzida);
        const produzidaNova = round3(produzidaAtual + qtd);

        const situacaoCalculada = computeSituacao({ prevista, produzida: produzidaNova });
        const faltante = Math.max(0, round3(prevista - produzidaNova));

        const [itemRows] = await connection.query(
            `
            SELECT
                IdOrdemServico,
                IdOrdemServicoItem,
                IdMaterial,
                CodMatFabricante
            FROM ordemservicoitem
            WHERE IdOrdemServicoItem = ?
            LIMIT 1
            `,
            [proc.IdOrdemServicoItem]
        );
        const item = itemRows && itemRows[0] ? itemRows[0] : {};

        const shouldFinalize = Boolean(finalizar) || situacaoCalculada === 'CONCLUIDO';
        const situacaoNova = shouldFinalize ? 'CONCLUIDO' : situacaoCalculada;

        await connection.query(
            `
            UPDATE ordemservicoitem_processo
            SET
                QtdeProduzida = ?,
                Situacao = ?,
                Observacao = COALESCE(?, Observacao),
                DataInicio = CASE WHEN DataInicio IS NULL THEN NOW() ELSE DataInicio END,
                UsuarioInicio = CASE WHEN UsuarioInicio IS NULL OR UsuarioInicio = '' THEN ? ELSE UsuarioInicio END,
                DataFim = CASE WHEN ? = 1 THEN NOW() ELSE DataFim END,
                UsuarioFim = CASE WHEN ? = 1 THEN ? ELSE UsuarioFim END
            WHERE IdOSItemProcesso = ?
            `,
            [produzidaNova, situacaoNova, observacao || null, usuario, shouldFinalize ? 1 : 0, shouldFinalize ? 1 : 0, usuario, id]
        );

        await connection.query(
            `
            INSERT INTO ordemservicoitemcontrole
            (
                IdOrdemServico,
                IdOrdemServicoItem,
                IdOSItemProcesso,
                Processo,
                CodigoJuridicoMat,
                QtdeTotal,
                IdMaterial,
                QtdeProduzida,
                QtdeFaltante,
                CriadoPor,
                DataCriacao,
                Situacao,
                Origem
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
            `,
            [
                item.IdOrdemServico || null,
                proc.IdOrdemServicoItem || null,
                proc.IdOSItemProcesso,
                String(proc.IdProcesso ?? ''),
                item.CodMatFabricante || null,
                prevista || null,
                item.IdMaterial || null,
                qtd,
                faltante,
                usuario,
                situacaoNova,
                'WEB'
            ]
        );

        // ------------------------------------------------------------------------------------------
        // [INTEGRAÇÃO PROTHEUS] - Baixa Simples Automática
        // ------------------------------------------------------------------------------------------
        if (companyConfig.apontamento_simples_protheus_active) {
            try {
                // Obter nome do processo e número da OP
                const [processoRows] = await connection.query(`SELECT processofabricacao as Descricao, CodigoProcessoFabricacao as Codigo FROM processofabricacao WHERE IdProcessoFabricacao = ?`, [proc.IdProcesso]);
                const processoCodigo = processoRows[0]?.Codigo || '';
                
                const [osRows] = await connection.query(`SELECT Numero FROM ordemservico WHERE IdOrdemServico = ?`, [item.IdOrdemServico]);
                const opNumero = osRows[0]?.Numero || '';

                const validProcessos = (companyConfig.apontamento_simples_processos || '').split(',').map(s => s.trim().toUpperCase());
                
                if (processoCodigo && validProcessos.includes(processoCodigo.toUpperCase())) {
                    console.log(`[PROTHEUS API] Engatilhando baixa de apontamento para OP ${opNumero}, Produto ${item.CodMatFabricante}`);
                    
                    const axios = require('axios');
                    const https = require('https');
                    
                    const payload = {
                        data: {
                            CFILANT: "0101",
                            EMPRESA: "01",
                            NOPER: 3,
                            apontamentosOrdensProducao: [{
                                C2_OP: String(opNumero).trim(),
                                C2_PRODUTO: String(item.CodMatFabricante).trim(),
                                C2_QUANT: qtd
                            }]
                        }
                    };

                    const agent = new https.Agent({ rejectUnauthorized: false });
                    axios.post(
                        'https://192.168.1.60:47500/ordem-producao/apontamento-simples',
                        payload,
                        { httpsAgent: agent, timeout: 15000 }
                    ).then(response => {
                        console.log(`[PROTHEUS API SUCESSO] Apontamento OP ${opNumero}:`, response.data);
                    }).catch(err => {
                        console.error(`[PROTHEUS API ERRO] Falha ao integrar apontamento OP ${opNumero}:`, err.response?.data || err.message);
                    });
                }
            } catch (integracaoError) {
                console.error('[PROTHEUS API ERRO INTERNO] Falha ao tentar engatilhar baixa:', integracaoError);
            }
        }
        // ------------------------------------------------------------------------------------------

        // Se TODOS os processos do item estiverem concluídos, marcar item como finalizado
        const [countsRows] = await connection.query(
            `
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN UPPER(TRIM(COALESCE(Situacao, ''))) IN ('CONCLUIDO', 'CONCLUÍDO', 'FINALIZADO') THEN 1 ELSE 0 END) AS concluidos
            FROM ordemservicoitem_processo
            WHERE IdOrdemServicoItem = ?
            `,
            [proc.IdOrdemServicoItem]
        );
        const counts = countsRows && countsRows[0] ? countsRows[0] : { total: 0, concluidos: 0 };
        const totalProc = toNumber(counts.total);
        const concluidosProc = toNumber(counts.concluidos);
        const allConcluded = totalProc > 0 && concluidosProc === totalProc;

        if (allConcluded) {
            await connection.query(
                `
                UPDATE ordemservicoitem
                SET
                    OrdemServicoItemFinalizado = 'S',
                    DataFinalizado = COALESCE(DataFinalizado, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')),
                    UsuarioFinalizado = COALESCE(UsuarioFinalizado, ?)
                WHERE IdOrdemServicoItem = ?
                `,
                [usuario, proc.IdOrdemServicoItem]
            );
        }

        await connection.commit();

        try {
            // Emite feed do Hermes informando do apontamento
            emitHermesAlert(`🛠️ **Apontamento registrado**: Usuário **${usuario}** produziu **${qtd}** peças da OS **${item.IdOrdemServico || '?'}** (Processo: ${proc.IdProcesso})`, 'production');
        } catch (e) { console.error('Erro ao emitir alerta:', e); }

        res.json({
            success: true,
            processo: {
                IdOSItemProcesso: proc.IdOSItemProcesso,
                IdOrdemServicoItem: proc.IdOrdemServicoItem,
                IdProcesso: proc.IdProcesso,
                QtdePrevista: prevista,
                QtdeProduzida: produzidaNova,
                QtdeFaltante: faltante,
                Situacao: situacaoNova,
                item_finalizado: allConcluded
            }
        });
    } catch (error) {
        try { await connection.rollback(); } catch { }
        console.error('[SINCO APONTAMENTO] Erro ao apontar:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao registrar apontamento' });
    } finally {
        connection.release();
    }
});


// GET /api/sinco-apontamento/os/:osId/processos-planejamento
// Retorna lista de processos distintos da OS com as datas planejadas atuais (se existirem)
router.get('/os/:osId/processos-planejamento', async (req, res) => {
    try {
        const { osId } = req.params;

        // Agrupa por código de processo e pega as datas do primeiro item encontrado (ou MIN/MAX)
        // Se houver múltiplas datas diferentes para o mesmo processo, pega a primeira não nula
        const [rows] = await mysqlPool.query(`
            SELECT 
                COALESCE(f.processofabricacao, p.IdProcesso) as NomeProcesso,
                f.CodigoProcessoFabricacao,
                p.IdProcesso,
                MIN(p.SequenciaExecucao) as Sequencia,
                MAX(p.DataPlanejadaInicio) as DataPlanejadaInicio,
                MAX(p.DataPlanejadaFim) as DataPlanejadaFim
            FROM ordemservicoitem i
            JOIN ordemservicoitem_processo p ON p.IdOrdemServicoItem = i.IdOrdemServicoItem
            LEFT JOIN processofabricacao f ON f.IdProcessoFabricacao = p.IdProcesso
            WHERE i.IdOrdemServico = ?
            GROUP BY COALESCE(f.processofabricacao, p.IdProcesso), f.CodigoProcessoFabricacao, p.IdProcesso
            ORDER BY MIN(p.SequenciaExecucao)
        `, [osId]);

        res.json(rows);
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar planejamento:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/sinco-apontamento/os/:osId/processos-planejamento
// Atualiza datas planejadas para todos os itens da OS com os processos especificados
router.put('/os/:osId/processos-planejamento', async (req, res) => {
    try {
        const { osId } = req.params;
        const { processos } = req.body; // Array de { IdProcesso, DataPlanejadaInicio, DataPlanejadaFim }

        if (!Array.isArray(processos) || processos.length === 0) {
            return res.status(400).json({ error: 'Nenhum processo fornecido para atualização.' });
        }

        const connection = await mysqlPool.getConnection();
        await connection.beginTransaction();

        try {
            for (const proc of processos) {
                // Se IdProcesso for string numérica, converte. Se for null/undefined, pula.
                if (!proc.IdProcesso) continue;

                const dataInicio = proc.DataPlanejadaInicio ? new Date(proc.DataPlanejadaInicio).toISOString().slice(0, 10) : null;
                const dataFim = proc.DataPlanejadaFim ? new Date(proc.DataPlanejadaFim).toISOString().slice(0, 10) : null;

                // Atualiza ordemservicoitem_processo para todos os itens desta OS que tenham este processo
                await connection.query(`
                    UPDATE ordemservicoitem_processo p
                    JOIN ordemservicoitem i ON i.IdOrdemServicoItem = p.IdOrdemServicoItem
                    SET 
                        p.DataPlanejadaInicio = ?,
                        p.DataPlanejadaFim = ?
                    WHERE i.IdOrdemServico = ? AND p.IdProcesso = ?
                `, [dataInicio, dataFim, osId, proc.IdProcesso]);
            }

            await connection.commit();
            res.json({ message: 'Planejamento atualizado com sucesso.' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao salvar planejamento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// GET /api/sinco-apontamento/dashboard/por-usuario
// Apontamentos agrupados por Usuário ou Processo × Dia
// Query params: data_inicio, data_fim, usuario, processo, grupo_por
// ============================================================
router.get('/dashboard/por-usuario', async (req, res) => {
    try {
        const { data_inicio, data_fim, usuario, processo, grupo_por = 'usuario' } = req.query;

        // Default: últimos 30 dias
        const hoje = new Date();
        const defaultFim = hoje.toISOString().slice(0, 10);
        const defaultInicio = new Date(hoje - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const di = data_inicio || defaultInicio;
        const df = data_fim || defaultFim;

        let whereExtra = '';
        const params = [di, df];

        if (usuario) {
            whereExtra += ` AND UPPER(TRIM(p.UsuarioFim)) = UPPER(TRIM(?))`;
            params.push(usuario);
        }

        if (processo) {
            whereExtra += ` AND f.CodigoProcessoFabricacao = ?`;
            params.push(processo);
        }

        console.log('📊 [SINCO DASHBOARD] Query params:', { di, df, usuario, processo, grupo_por });

        const querySql = `
            SELECT
                UPPER(TRIM(p.UsuarioFim))                                     AS usuario,
                COALESCE(
                    DATE(STR_TO_DATE(p.DataFim, '%Y-%m-%d %H:%i:%s')),
                    DATE(STR_TO_DATE(p.DataFim, '%d/%m/%Y'))
                )                                                              AS data_apontamento,
                f.CodigoProcessoFabricacao                                    AS cod_processo,
                f.processofabricacao                                          AS nome_processo,
                COUNT(*)                                                      AS qtd_apontamentos,
                SUM(p.QtdeProduzida)                                          AS total_produzido,
                SUM(p.QtdePrevista)                                           AS total_previsto,
                GROUP_CONCAT(DISTINCT i.IdOrdemServico ORDER BY i.IdOrdemServico SEPARATOR ',') AS os_ids,
                GROUP_CONCAT(DISTINCT i.CodMatFabricante ORDER BY i.CodMatFabricante SEPARATOR ', ') AS amostras_pecas
            FROM ordemservicoitem_processo p
            JOIN ordemservicoitem i
                ON i.IdOrdemServicoItem = p.IdOrdemServicoItem
            LEFT JOIN processofabricacao f
                ON f.IdProcessoFabricacao = p.IdProcesso
            WHERE
                p.UsuarioFim IS NOT NULL
                AND p.UsuarioFim <> ''
                AND p.DataFim IS NOT NULL
                AND p.DataFim <> ''
                AND p.Situacao <> 'CANCELADO'
                AND COALESCE(
                    DATE(STR_TO_DATE(p.DataFim, '%Y-%m-%d %H:%i:%s')),
                    DATE(STR_TO_DATE(p.DataFim, '%d/%m/%Y'))
                ) BETWEEN ? AND ?
                ${whereExtra}
            GROUP BY
                UPPER(TRIM(p.UsuarioFim)),
                data_apontamento,
                f.IdProcessoFabricacao
            ORDER BY
                data_apontamento DESC,
                usuario ASC,
                qtd_apontamentos DESC
        `;

        const [rows] = await mysqlPool.query(querySql, params);

        // Agrupa: User ou Process
        const result = [];
        const mapAgrupador = {};

        rows.forEach(r => {
            const userName = r.usuario || 'NÃO IDENTIFICADO';
            const procCode = r.cod_processo || 'S/ COD';
            const procName = r.nome_processo || 'S/ NOME';
            const processLabel = `${procCode} - ${procName}`;

            const groupKey = grupo_por === 'processo' ? processLabel : userName;
            const detailName = grupo_por === 'processo' ? userName : processLabel;

            if (!mapAgrupador[groupKey]) {
                mapAgrupador[groupKey] = {
                    chave: groupKey,
                    total_geral: 0,
                    dias: []
                };
                result.push(mapAgrupador[groupKey]);
            }

            const groupObj = mapAgrupador[groupKey];

            const dataIso = r.data_apontamento instanceof Date
                ? r.data_apontamento.toISOString().slice(0, 10)
                : String(r.data_apontamento).slice(0, 10);

            let dayObj = groupObj.dias.find(d => d.data === dataIso);
            if (!dayObj) {
                dayObj = {
                    data: dataIso,
                    total_dia: 0,
                    detalhes: []
                };
                groupObj.dias.push(dayObj);
            }

            const produzido = Number(r.total_produzido) || 0;
            groupObj.total_geral += produzido;
            dayObj.total_dia += produzido;

            dayObj.detalhes.push({
                identificador: detailName,
                nome: detailName,
                qtd_apontamentos: Number(r.qtd_apontamentos) || 0,
                total_produzido: produzido,
                total_previsto: Number(r.total_previsto) || 0,
                os_ids: r.os_ids ? r.os_ids.split(',').map(x => x.trim()).filter(Boolean) : [],
                amostras_pecas: r.amostras_pecas ? r.amostras_pecas.split(',').map(x => x.trim()).slice(0, 5).join(', ') : ''
            });
        });

        const usuarios_lista = [...new Set(rows.map(r => r.usuario).filter(Boolean))].sort();
        const processos_lista = [...new Set(rows.map(r => r.cod_processo).filter(Boolean))].sort();

        // Sort days
        result.forEach(g => {
            g.dias.sort((a, b) => b.data.localeCompare(a.data));
        });

        result.sort((a, b) => b.total_geral - a.total_geral);

        res.json({ grupos: result, usuarios_lista, processos_lista, periodo: { di, df } });

    } catch (error) {
        console.error('[SINCO] Erro dashboard por-usuario:', error);
        res.status(500).json({ error: error.message });
    }
});


// GET /api/sinco-apontamento/pedido/:pedido/bom
// Retorna a estrutura (BOM) dos itens do pedido baseando-se nas OPs geradas
router.get('/pedido/:pedido/bom', async (req, res) => {
    try {
        const { pedido } = req.params;
        const paramPedido = String(pedido).trim();

        if (!paramPedido) {
            return res.status(400).json({ error: 'Pedido não informado.' });
        }

        const sql = `
            SELECT 
                C2.C2_NUM AS "OP",
                C2.C2_PRODUTO AS "Produto_Final",
                G1.G1_COMP AS "Cod_Componente",
                B1_COMP.B1_DESC AS "Descricao_Componente",
                G1.G1_QUANT AS "Qtd_Por_Unidade",
                (G1.G1_QUANT * C2.C2_QUANT) AS "Total_Necessario",
                B1_COMP.B1_UM AS "UM"
            FROM 
                public.SC2010 C2
            INNER JOIN 
                public.SG1010 G1 ON TRIM(G1.G1_COD) = TRIM(C2.C2_PRODUTO) AND TRIM(COALESCE(G1.D_E_L_E_T_, '')) = ''
            INNER JOIN 
                public.SB1010 B1_COMP ON TRIM(B1_COMP.B1_COD) = TRIM(G1.G1_COMP) AND TRIM(COALESCE(B1_COMP.D_E_L_E_T_, '')) = ''
            WHERE 
                TRIM(C2.C2_PEDIDO) = $1
                AND TRIM(COALESCE(C2.D_E_L_E_T_, '')) = ''
            ORDER BY 
                C2.C2_NUM, G1.G1_COMP;
        `;

        const result = await db.query(sql, [paramPedido]);
        res.json(result.rows);
    } catch (error) {
        console.error('[SINCO APONTAMENTO] Erro ao buscar BOM do pedido no Protheus:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao buscar BOM do pedido.' });
    }
});

module.exports = router;
