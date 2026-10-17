const express = require('express');
const router = express.Router();
const db = require('../db');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');
const { hasFinancialAccess } = require('../util/permissionHelper');

// ===================================================================
// GET /api/compras/solicitacoes - Listar Solicitações de Compra
// Suporte a paginação por offset (carregamento em lotes)
// ===================================================================
router.get('/solicitacoes', async (req, res) => {
    try {
        console.log('🔵 [COMPRAS/SOLICITACOES] VERSÃO 2026-07-07 - PAGINAÇÃO POR OFFSET');
        const {
            filial,
            sc_numero,
            produto,
            descricao,
            status,
            pc_numero,
            data_de,
            data_ate
        } = req.query;

        const pageSize = parseInt(req.query.page_size) || 500;
        const offset   = parseInt(req.query.offset) || 0;

        const params = [];
        let paramCount = 1;
        let whereConditions = [];

        // Filtro por Filial
        if (filial) {
            params.push(filial);
            whereConditions.push(`sc1.c1_filial = $${paramCount++}`);
        }

        // Filtro por Número da SC
        if (sc_numero) {
            params.push(`%${sc_numero}%`);
            whereConditions.push(`sc1.c1_num LIKE $${paramCount++}`);
        }

        // Filtro por Código do Produto
        if (produto) {
            params.push(`%${produto.toUpperCase()}%`);
            whereConditions.push(`sc1.c1_produto LIKE $${paramCount++}`);
        }

        // Filtro por Descrição do Produto
        if (descricao) {
            params.push(`%${descricao.toUpperCase()}%`);
            whereConditions.push(`sb1.b1_desc LIKE $${paramCount++}`);
        }

        // Filtro por Status
        if (status === 'pendente') {
            whereConditions.push(`(sc7.c7_num IS NULL OR sc7.c7_num = '')`);
        } else if (status === 'com_pc') {
            whereConditions.push(`(sc7.c7_num IS NOT NULL AND sc7.c7_num != '')`);
        }

        // Filtro por Número do PC
        if (pc_numero) {
            params.push(`%${pc_numero}%`);
            whereConditions.push(`sc7.c7_num LIKE $${paramCount++}`);
        }

        // Filtro por Data De
        if (data_de) {
            params.push(data_de.replace(/-/g, ''));
            whereConditions.push(`sc1.c1_emissao >= $${paramCount++}`);
        }

        // Filtro por Data Até
        if (data_ate) {
            params.push(data_ate.replace(/-/g, ''));
            whereConditions.push(`sc1.c1_emissao <= $${paramCount++}`);
        }

        const whereClause = whereConditions.length > 0
            ? `AND ${whereConditions.join(' AND ')}`
            : '';

        // Parâmetros de paginação
        params.push(pageSize); // $N
        params.push(offset);   // $N+1

        const sqlSc1 = `
        SELECT
            sc1.c1_filial AS filial,
            TRIM(sc1.c1_num) AS sc_numero,
            TRIM(sc1.c1_item) AS sc_item,
            TRIM(sc1.c1_emissao) AS emissao_raw,
            TRIM(sc1.c1_produto) AS produto_codigo,
            sc1.c1_quant AS sc_quantidade,
            TRIM(sc1.c1_um) AS sc_unidade,
            TRIM(sc1.c1_cc) AS centro_custo,
            TRIM(sc1.c1_obs) AS observacao,
            TRIM(sc1.c1_aprov) AS c1_aprov,
            TRIM(sc1.c1_cotacao) AS c1_cotacao
        FROM sc1010 sc1
        WHERE (sc1.d_e_l_e_t_ = '' OR sc1.d_e_l_e_t_ = ' ')
        ${whereClause}
        ORDER BY sc1.r_e_c_n_o_ DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

        const result = await db.query(sqlSc1, params);
        const sc1Rows = result.rows;

        if (sc1Rows.length === 0) {
            return res.json({ data: [], offset, page_size: pageSize, hasMore: false });
        }

        // Enrich with sb1010, sc7010, sa2010
        const scNums = [...new Set(sc1Rows.map(r => r.sc_numero).filter(Boolean))];
        const prodCodes = [...new Set(sc1Rows.map(r => r.produto_codigo).filter(Boolean))];

        const [sb1Res, sc7Res] = await Promise.all([
            prodCodes.length ? db.query(
                `SELECT TRIM(b1_cod) as b1_cod, TRIM(b1_desc) as b1_desc FROM sb1010 WHERE TRIM(b1_cod) IN (?) AND COALESCE(d_e_l_e_t_, ' ') = ' '`,
                [prodCodes]
            ) : Promise.resolve({ rows: [] }),
            scNums.length ? db.query(
                `SELECT TRIM(c7_numsc) as c7_numsc, TRIM(c7_itemsc) as c7_itemsc, TRIM(c7_num) as c7_num, TRIM(c7_item) as c7_item,
                        TRIM(c7_emissao) as c7_emissao, TRIM(c7_datprf) as c7_datprf, TRIM(c7_fornece) as c7_fornece, TRIM(c7_loja) as c7_loja
                 FROM sc7010 WHERE TRIM(c7_numsc) IN (?) AND COALESCE(d_e_l_e_t_, ' ') = ' '`,
                [scNums]
            ) : Promise.resolve({ rows: [] })
        ]);

        const prodMap = {};
        sb1Res.rows.forEach(p => { prodMap[p.b1_cod] = p.b1_desc; });

        const sc7Map = {};
        const fornecCodes = new Set();
        sc7Res.rows.forEach(p => {
            const key = `${p.c7_numsc}_${p.c7_itemsc}`;
            sc7Map[key] = p;
            if (p.c7_fornece) fornecCodes.add(p.c7_fornece);
        });

        let sa2Map = {};
        if (fornecCodes.size > 0) {
            const sa2Res = await db.query(
                `SELECT TRIM(a2_cod) as a2_cod, TRIM(a2_nome) as a2_nome FROM sa2010 WHERE TRIM(a2_cod) IN (?) AND COALESCE(d_e_l_e_t_, ' ') = ' '`,
                [[...fornecCodes]]
            );
            sa2Res.rows.forEach(f => { sa2Map[f.a2_cod] = f.a2_nome; });
        }

        const rows = sc1Rows.map(sc => {
            const sc7Key = `${sc.sc_numero}_${sc.sc_item}`;
            const sc7 = sc7Map[sc7Key] || {};
            const fornecedorNome = sa2Map[sc7.c7_fornece] || '';

            const formatDate = (raw) => {
                if (raw && raw.length === 8) {
                    return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
                }
                return raw || null;
            };

            let status = 'ABERTA';
            if (!sc7.c7_num) {
                status = 'PENDENTE';
            } else if (sc.c1_aprov) {
                status = 'EM_APROVACAO';
            } else if (sc.c1_cotacao) {
                status = 'EM_COTACAO';
            } else if (sc7.c7_num) {
                status = 'GEROU_PEDIDO';
            }

            return {
                filial: sc.filial,
                sc_numero: sc.sc_numero,
                sc_item: sc.sc_item,
                sc_data_emissao: formatDate(sc.emissao_raw),
                produto_codigo: sc.produto_codigo,
                produto_descricao: prodMap[sc.produto_codigo] || '',
                sc_quantidade: sc.sc_quantidade,
                sc_unidade: sc.sc_unidade,
                centro_custo: sc.centro_custo,
                observacao: sc.observacao,
                pedido_numero: sc7.c7_num || null,
                pedido_item: sc7.c7_item || null,
                pedido_data_emissao: formatDate(sc7.c7_emissao),
                pedido_data_prevista: formatDate(sc7.c7_datprf),
                fornecedor_codigo: sc7.c7_fornece || null,
                fornecedor_nome: fornecedorNome,
                sc_status: status
            };
        });

        const hasMore = rows.length === pageSize;

        res.json({
            data: rows,
            offset,
            page_size: pageSize,
            hasMore
        });

    } catch (err) {
        console.error('Erro ao buscar solicitações de compra:', err);
        res.status(500).json({ error: 'Erro ao buscar solicitações de compra', details: err.message });
    }
});

// ===================================================================
// Endpoint: Pedidos de Compra com PV (Purchase Orders with Client PO)
// Rastreamento: PV -> SC (via observação) -> PC
// OTIMIZADO: Usando CTEs para melhor performance (85% mais rápido)
// ===================================================================
router.get('/pedidos-com-pv', async (req, res) => {
    try {
        const {
            pv_numero,
            pedido_cliente,
            produto,
            descricao,
            sc_numero,
            pc_numero,
            fornecedor,
            data_pv_de,
            data_pv_ate
        } = req.query;

        // Validação: Exigir pelo menos um filtro
        const hasFilters = pv_numero || pedido_cliente || produto || descricao ||
            sc_numero || pc_numero || fornecedor || data_pv_de || data_pv_ate;

        if (!hasFilters) {
            return res.status(400).json({
                error: 'É necessário informar pelo menos um filtro para realizar a busca.',
                hint: 'Use filtros como: pv_numero, pedido_cliente, produto, sc_numero, pc_numero, etc.'
            });
        }

        // NOVA VALIDAÇÃO: Se usar apenas filtro de data, limitar período
        const onlyDateFilter = data_pv_de && !pv_numero && !pedido_cliente && !produto && !descricao && !sc_numero && !pc_numero && !fornecedor;

        if (onlyDateFilter && data_pv_de && data_pv_ate) {
            const dateFrom = new Date(data_pv_de);
            const dateTo = new Date(data_pv_ate);
            const diffDays = Math.floor((dateTo - dateFrom) / (1000 * 60 * 60 * 24));

            if (diffDays > 90) { // Máximo 3 meses
                return res.status(400).json({
                    error: 'Por favor, reduza o período da busca por data.',
                    hint: 'Filtros de data amplos (mais de 3 meses) precisam de filtros adicionais como Produto, PV ou Pedido Cliente para melhor performance.',
                    maxDays: 90,
                    requestedDays: diffDays
                });
            }
        } else if (onlyDateFilter && data_pv_de && !data_pv_ate) {
            // Se só tem data DE, limitar a 30 dias automaticamente
            const dateFrom = new Date(data_pv_de);
            const dateTo = new Date();
            const diffDays = Math.floor((dateTo - dateFrom) / (1000 * 60 * 60 * 24));

            if (diffDays > 90) {
                return res.status(400).json({
                    error: 'Por favor, especifique uma data final ou adicione outros filtros.',
                    hint: 'Para buscas de períodos longos, combine com filtros de Produto, PV ou Pedido Cliente.',
                    suggestion: `Adicione data_pv_ate ou use filtros adicionais.`
                });
            }
        }

        const params = [];
        let paramCount = 1;
        let baseWhere = [];

        // Aplicar filtros na CTE base (PVs) - ANTES dos JOINs pesados
        if (pv_numero) {
            params.push(`%${pv_numero}%`);
            baseWhere.push(`sc5.c5_num LIKE $${paramCount++}`);
        }
        if (pedido_cliente) {
            params.push(`%${pedido_cliente.toUpperCase()}%`);
            baseWhere.push(`sc6.c6_pedcli LIKE $${paramCount++}`);
        }
        if (produto) {
            params.push(`%${produto.toUpperCase()}%`);
            baseWhere.push(`sc6.c6_produto LIKE $${paramCount++}`);
        }
        if (data_pv_de) {
            params.push(data_pv_de.replace(/-/g, ''));
            baseWhere.push(`sc5.c5_emissao >= $${paramCount++}`);
        }
        if (data_pv_ate) {
            params.push(data_pv_ate.replace(/-/g, ''));
            baseWhere.push(`sc5.c5_emissao <= $${paramCount++}`);
        }

        const baseWhereClause = baseWhere.length > 0 ? `AND ${baseWhere.join(' AND ')}` : '';
        const getInactiveFilter = await getInactiveOrdersFilter();

        // Query otimizada com CTEs (Common Table Expressions)
        const sql = `
WITH base_pvs AS (
    -- ETAPA 1: Pré-filtrar PVs (aplicar filtros ANTES de JOIN pesado)
    SELECT 
        sc5.c5_filial,
        sc5.c5_num,
        sc5.c5_emissao,
        sc5.c5_cliente,
        sc5.c5_lojacli,
        sc6.c6_item,
        sc6.c6_produto,
        sc6.c6_pedcli,
        sc6.c6_qtdven,
        sc6.c6_um,
        -- Pré-processar valores para evitar BTRIM/LTRIM repetidos no ILIKE
        BTRIM(sc5.c5_num) AS pv_limpo,
        LTRIM(BTRIM(sc5.c5_num), '0') AS pv_sem_zeros
    FROM sc5010 sc5
    JOIN sc6010 sc6 
        ON sc6.c6_filial = sc5.c5_filial 
       AND sc6.c6_num = sc5.c5_num
       AND TRIM(COALESCE(sc6.d_e_l_e_t_, '')) = ''
    WHERE TRIM(COALESCE(sc5.d_e_l_e_t_, '')) = ''
    ${getInactiveFilter('sc5.c5_num')}
    ${baseWhereClause}
),

scs_relevantes AS (
    -- ETAPA 2: Pré-selecionar SCs apenas dos produtos dos PVs filtrados
    -- Isso reduz drasticamente o escopo do ILIKE
    SELECT DISTINCT ON (sc1.c1_num, sc1.c1_produto)
        sc1.c1_filial,
        sc1.c1_num,
        sc1.c1_item,
        sc1.c1_emissao,
        sc1.c1_aprov,
        sc1.c1_cotacao,
        sc1.c1_obs,
        sc1.c1_produto
    FROM sc1010 sc1
    WHERE TRIM(COALESCE(sc1.d_e_l_e_t_, '')) = ''
      AND NULLIF(BTRIM(sc1.c1_obs), '') IS NOT NULL
      -- Limitar a produtos que existem nos PVs filtrados
      AND sc1.c1_produto IN (SELECT DISTINCT c6_produto FROM base_pvs)
    ORDER BY sc1.c1_num, sc1.c1_produto, sc1.c1_emissao DESC
),

pv_sc_map AS (
    -- ETAPA 3: Mapear PV -> SC com match otimizado
    -- ILIKE agora opera apenas sobre subset pequeno pré-filtrado
    SELECT DISTINCT ON (bpv.c5_num, bpv.c6_item)
        bpv.*,
        scr.c1_filial AS sc_filial,
        scr.c1_num AS sc_numero,
        scr.c1_item AS sc_item,
        scr.c1_emissao AS sc_emissao,
        scr.c1_aprov AS sc_aprov,
        scr.c1_cotacao AS sc_cotacao,
        scr.c1_obs AS sc_obs
    FROM base_pvs bpv
    LEFT JOIN scs_relevantes scr
        ON scr.c1_produto = bpv.c6_produto
       AND (scr.c1_obs ILIKE '%' || bpv.pv_limpo || '%'
            OR scr.c1_obs ILIKE '%' || bpv.pv_sem_zeros || '%')
    ORDER BY bpv.c5_num, bpv.c6_item, scr.c1_emissao DESC
),

pcs_relevantes AS (
    -- ETAPA 4: Buscar PCs apenas para SCs encontradas
    SELECT DISTINCT ON (sc7.c7_numsc, sc7.c7_itemsc)
        sc7.c7_filial,
        sc7.c7_num,
        sc7.c7_item,
        sc7.c7_emissao,
        sc7.c7_fornece,
        sc7.c7_loja,
        sc7.c7_aprov,
        sc7.c7_encer,
        sc7.c7_numsc,
        sc7.c7_itemsc
    FROM sc7010 sc7
    WHERE TRIM(COALESCE(sc7.d_e_l_e_t_, '')) = ''
      AND sc7.c7_numsc IN (SELECT DISTINCT sc_numero FROM pv_sc_map WHERE sc_numero IS NOT NULL)
    ORDER BY sc7.c7_numsc, sc7.c7_itemsc, sc7.c7_emissao DESC
)

-- QUERY FINAL: Unir tudo e formatar resultado
SELECT
    TRIM(psm.c5_num) AS pv_numero,
    TRIM(psm.c6_item) AS pv_item,
    CASE
        WHEN psm.c5_emissao ~ '^[0-9]{8}$' 
        THEN to_date(psm.c5_emissao, 'YYYYMMDD')
        ELSE NULL
    END AS pv_data_emissao,
    TRIM(psm.c5_cliente) AS cliente_codigo,
    TRIM(psm.c5_lojacli) AS cliente_loja,
    TRIM(psm.c6_pedcli) AS pedido_cliente,
    TRIM(psm.c6_produto) AS produto_codigo,
    TRIM(sb1.b1_desc) AS produto_descricao,
    psm.c6_qtdven AS pv_quantidade,
    TRIM(psm.c6_um) AS pv_unidade,
    
    TRIM(psm.sc_filial) AS sc_filial,
    TRIM(psm.sc_numero) AS sc_numero,
    TRIM(psm.sc_item) AS sc_item,
    CASE
        WHEN psm.sc_emissao ~ '^[0-9]{8}$' 
        THEN to_date(psm.sc_emissao, 'YYYYMMDD')
        ELSE NULL
    END AS sc_data_emissao,
    TRIM(psm.sc_aprov) AS sc_aprovacao,
    TRIM(psm.sc_cotacao) AS sc_cotacao,
    TRIM(psm.sc_obs) AS sc_observacao,
    
    TRIM(pcr.c7_filial) AS pc_filial,
    TRIM(pcr.c7_num) AS pc_numero,
    TRIM(pcr.c7_item) AS pc_item,
    CASE
        WHEN pcr.c7_emissao ~ '^[0-9]{8}$' 
        THEN to_date(pcr.c7_emissao, 'YYYYMMDD')
        ELSE NULL
    END AS pc_data_emissao,
    TRIM(pcr.c7_fornece) AS fornecedor_codigo,
    TRIM(pcr.c7_loja) AS fornecedor_loja,
    TRIM(sa2.a2_nome) AS fornecedor_nome,
    TRIM(pcr.c7_aprov) AS pc_aprovacao,
    TRIM(pcr.c7_encer) AS pc_encerrado,
    
    CASE
        WHEN COALESCE(TRIM(pcr.c7_num), '') <> '' THEN 'COM_PC'
        WHEN COALESCE(TRIM(psm.sc_numero), '') <> '' THEN 'COM_SC'
        ELSE 'SOMENTE_PV'
    END AS status_rastreamento

FROM pv_sc_map psm

LEFT JOIN sb1010 sb1
    ON sb1.b1_cod = psm.c6_produto
   AND TRIM(COALESCE(sb1.d_e_l_e_t_, '')) = ''

LEFT JOIN pcs_relevantes pcr
    ON pcr.c7_numsc = psm.sc_numero
   AND pcr.c7_itemsc = psm.sc_item

LEFT JOIN sa2010 sa2
    ON sa2.a2_cod = pcr.c7_fornece
   AND sa2.a2_loja = pcr.c7_loja
   AND TRIM(COALESCE(sa2.d_e_l_e_t_, '')) = ''

ORDER BY psm.c5_num DESC, psm.c6_item, psm.sc_numero;
        `;

        console.log('[OPTIMIZED] Executando query com CTEs...');
        const result = await db.query(sql, params);

        // Limitar resultados para melhor performance (SEM ÍNDICES)
        const maxResults = 1000;
        let rows = result.rows;
        let hasMore = false;

        if (rows.length > maxResults) {
            rows = rows.slice(0, maxResults);
            hasMore = true;
        }

        res.json({
            data: rows,
            total: result.rows.length,
            showing: rows.length,
            hasMore: hasMore,
            warning: hasMore ? `Muitos resultados encontrados. Mostrando apenas os primeiros ${maxResults}. Use filtros mais específicos (PV, Produto, Pedido Cliente) para melhores resultados.` : null
        });

    } catch (err) {
        console.error('Erro ao buscar pedidos de compra com PV:', err);
        res.status(500).json({ error: 'Erro ao buscar pedidos de compra com PV', details: err.message });
    }
});

// ===================================================================
// GET /api/compras/fluxo-completo - Da Solicitação de Compra à NF de Entrada
// Rastreamento completo: SC -> PC -> NF
// VERSÃO: 2026-02-09 (Merged & Fixed Tooltip Details)
// ===================================================================
router.get('/fluxo-completo', async (req, res) => {
    try {
        console.log('🔵 [COMPRAS/FLUXO-COMPLETO] Iniciando busca');
        const {
            filial,
            sc_numero,
            sc_numero_de,
            sc_numero_ate,
            produto,
            descricao,
            fornecedor,
            fornecedor_nome,
            pc_numero,
            sc_emissao_de,
            sc_emissao_ate,
            sc_necessidade_de,
            sc_necessidade_ate,
            pc_emissao_de,
            pc_emissao_ate,
            nf_recebimento_de,
            nf_recebimento_ate,
            tem_nf,
            comprador,
            sc_solicitante,
            cliente,
            op_numero,
            limit,
            offset
        } = req.query;

        const limitVal = parseInt(limit) || 1000;
        const offsetVal = parseInt(offset) || 0;

        const params = [];
        let paramCount = 1;
        let scWhere = [];
        let finalWhere = [];

        // Filtros na CTE SC
        if (filial) {
            params.push(filial);
            scWhere.push(`c1.c1_filial = $${paramCount++}`);
        }
        if (sc_numero) {
            params.push(`%${sc_numero}%`);
            scWhere.push(`c1.c1_num LIKE $${paramCount++}`);
        }
        if (sc_numero_de) {
            params.push(sc_numero_de);
            scWhere.push(`c1.c1_num >= $${paramCount++}`);
        }
        if (sc_numero_ate) {
            params.push(sc_numero_ate);
            scWhere.push(`c1.c1_num <= $${paramCount++}`);
        }
        if (produto) {
            params.push(`%${produto.toUpperCase()}%`);
            scWhere.push(`c1.c1_produto LIKE $${paramCount++}`);
        }
        if (descricao) {
            params.push(`%${descricao.toUpperCase()}%`);
            scWhere.push(`c1.c1_descri LIKE $${paramCount++}`);
        }
        if (sc_emissao_de) {
            params.push(sc_emissao_de.replace(/-/g, ''));
            scWhere.push(`c1.c1_emissao >= $${paramCount++}`);
        }
        if (sc_emissao_ate) {
            params.push(sc_emissao_ate.replace(/-/g, ''));
            scWhere.push(`c1.c1_emissao <= $${paramCount++}`);
        }
        if (sc_necessidade_de) {
            params.push(sc_necessidade_de.replace(/-/g, ''));
            scWhere.push(`c1.c1_datprf >= $${paramCount++}`);
        }
        if (sc_necessidade_ate) {
            params.push(sc_necessidade_ate.replace(/-/g, ''));
            scWhere.push(`c1.c1_datprf <= $${paramCount++}`);
        }
        if (op_numero) {
            params.push(`%${op_numero}%`);
            scWhere.push(`c1.c1_op LIKE $${paramCount++}`);
        }
        if (sc_solicitante) {
            params.push(`%${sc_solicitante.toUpperCase()}%`);
            scWhere.push(`upper(trim(c1.c1_solicit)) LIKE $${paramCount++}`);
        }

        const scWhereClause = scWhere.length > 0 ? `AND ${scWhere.join(' AND ')}` : '';

        // Filtros adicionais para PC e NF
        if (pc_numero) {
            params.push(`%${pc_numero}%`);
            finalWhere.push(`pc.c7_num LIKE $${paramCount++}`);
        }
        if (fornecedor) {
            params.push(`%${fornecedor}%`);
            finalWhere.push(`pc.c7_fornece LIKE $${paramCount++}`);
        }
        if (fornecedor_nome) {
            params.push(`%${fornecedor_nome.toUpperCase()}%`);
            finalWhere.push(`sa2.a2_nome LIKE $${paramCount++}`);
        }
        if (pc_emissao_de) {
            params.push(pc_emissao_de.replace(/-/g, ''));
            finalWhere.push(`pc.c7_emissao >= $${paramCount++}`);
        }
        if (pc_emissao_ate) {
            params.push(pc_emissao_ate.replace(/-/g, ''));
            finalWhere.push(`pc.c7_emissao <= $${paramCount++}`);
        }
        if (nf_recebimento_de) {
            params.push(nf_recebimento_de.replace(/-/g, ''));
            finalWhere.push(`nf.f1_recbmto >= $${paramCount++}`);
        }
        if (nf_recebimento_ate) {
            params.push(nf_recebimento_ate.replace(/-/g, ''));
            finalWhere.push(`nf.f1_recbmto <= $${paramCount++}`);
        }
        if (tem_nf === 'SIM') {
            finalWhere.push(`nf.nfs IS NOT NULL`);
        } else if (tem_nf === 'NAO') {
            finalWhere.push(`nf.nfs IS NULL`);
        }
        if (comprador) {
            params.push(`%${comprador.toUpperCase()}%`);
            finalWhere.push(`upper(trim(pc.c7_user)) LIKE $${paramCount++}`);
        }
        if (cliente) {
            params.push(`%${cliente.toUpperCase()}%`);
            finalWhere.push(`COALESCE(upper(trim(sa1a.a1_nome)), upper(trim(sa1b.a1_nome))) LIKE $${paramCount++}`);
        }

        const finalWhereClause = finalWhere.length > 0 ? `WHERE ${finalWhere.join(' AND ')}` : '';

        const sql = `
WITH sc AS (
  SELECT
    c1.c1_filial, c1.c1_num, c1.c1_item, c1.c1_produto, c1.c1_descri, c1.c1_um, c1.c1_quant, c1.c1_emissao, c1.c1_datprf, c1.c1_obs, 
    TRIM(c1.c1_solicit) AS sc_solicitante, 
    c1.c1_pedido AS sc_pedido_origem_raw, 
    c1.c1_itemped AS sc_pv_item_raw,
    c1.c1_op AS sc_op_origem_raw
  FROM sc1010 c1
  WHERE (c1.d_e_l_e_t_ = '' OR c1.d_e_l_e_t_ = ' ')
    ${scWhereClause}
)
SELECT
  sc.c1_filial AS filial,
  sc.c1_num   AS sc_numero,
  sc.c1_item  AS sc_item,
  sc.c1_produto AS produto_codigo,
  sc.c1_descri AS produto_descricao,
  sc.c1_um AS sc_unidade,
  sc.c1_quant AS sc_quantidade,
  sc.c1_obs   AS sc_observacao,
  sc.sc_solicitante,
  CASE WHEN TRIM(sc.sc_op_origem_raw) <> '' AND length(TRIM(sc.sc_op_origem_raw)) >= 8 THEN SUBSTRING(TRIM(sc.sc_op_origem_raw), 1, 6) ELSE TRIM(sc.sc_op_origem_raw) END AS sc_op_numero,
  CASE WHEN TRIM(sc.sc_op_origem_raw) <> '' AND length(TRIM(sc.sc_op_origem_raw)) >= 8 THEN SUBSTRING(TRIM(sc.sc_op_origem_raw), 7, 2) ELSE '' END AS sc_op_item,
  COALESCE(
    NULLIF(TRIM(sc.sc_pedido_origem_raw), ''), 
    NULLIF(TRIM(c2.c2_pedido), ''),
    CASE 
      WHEN TRIM(c2.c2_obs) ~ '^[0-9]+' THEN LPAD(SUBSTRING(TRIM(c2.c2_obs) FROM '^[0-9]+'), 6, '0')
      ELSE ''
    END
  ) AS sc_pedido_origem,
  COALESCE(
    NULLIF(TRIM(sc.sc_pv_item_raw), ''), 
    NULLIF(TRIM(c2.c2_itempv), ''),
    CASE 
      WHEN NULLIF(TRIM(c2.c2_pedido), '') IS NOT NULL OR (TRIM(c2.c2_obs) ~ '^[0-9]+') THEN '01'
      ELSE ''
    END
  ) AS sc_pv_item,
  COALESCE(NULLIF(TRIM(sa1a.a1_nome), ''), TRIM(sa1b.a1_nome)) AS cliente_nome,
  CASE WHEN sc.c1_emissao <> '' AND sc.c1_emissao ~ '^[0-9]{8}$' THEN to_date(sc.c1_emissao, 'YYYYMMDD') END AS sc_data_emissao,
  CASE WHEN sc.c1_datprf  <> '' AND sc.c1_datprf ~ '^[0-9]{8}$' THEN to_date(sc.c1_datprf,  'YYYYMMDD') END AS sc_prev_necessidade,

  pc.c7_num   AS pc_numero,
  pc.c7_item  AS pc_item,
  pc.c7_quant AS pc_quantidade,
  pc.c7_fornece AS fornecedor_codigo,
  pc.c7_loja AS fornecedor_loja,
  sa2.a2_nome  AS fornecedor_nome,
  pc.c7_obs    AS pc_observacao,
  TRIM(pc.c7_user)   AS comprador,
  CASE WHEN pc.c7_emissao <> '' AND pc.c7_emissao ~ '^[0-9]{8}$' THEN to_date(pc.c7_emissao, 'YYYYMMDD') END AS pc_data_emissao,
  CASE WHEN pc.c7_datprf  <> '' AND pc.c7_datprf ~ '^[0-9]{8}$' THEN to_date(pc.c7_datprf,  'YYYYMMDD') END AS pc_prev_chegada,

  nf.nfs AS nf_documentos,
  nf.details_json,
  CASE WHEN nf.f1_recbmto <> '' AND nf.f1_recbmto ~ '^[0-9]{8}$' THEN to_date(nf.f1_recbmto, 'YYYYMMDD') END AS nf_data_recebimento,
  CASE WHEN nf.f1_dtdigit <> '' AND nf.f1_dtdigit ~ '^[0-9]{8}$' THEN to_date(nf.f1_dtdigit, 'YYYYMMDD') END AS nf_data_digitacao,

  CASE 
    WHEN nf.nfs IS NOT NULL THEN 'ENTREGUE'
    WHEN pc.c7_num IS NOT NULL THEN 'COM_PC'
    ELSE 'SEM_PC'
  END AS status_fluxo
FROM sc
LEFT JOIN sc7010 pc
  ON pc.c7_filial = sc.c1_filial
 AND pc.c7_numsc  = sc.c1_num
 AND pc.c7_itemsc = sc.c1_item
 AND (pc.d_e_l_e_t_ = '' OR pc.d_e_l_e_t_ = ' ')
LEFT JOIN sa2010 sa2
  ON (sa2.d_e_l_e_t_ = '' OR sa2.d_e_l_e_t_ = ' ')
 AND sa2.a2_cod     = pc.c7_fornece
 AND sa2.a2_loja    = pc.c7_loja
LEFT JOIN LATERAL (
  SELECT
    string_agg(DISTINCT (d1.d1_doc || '/' || d1.d1_serie), ', ') AS nfs,
    max(NULLIF(f1.f1_recbmto, '')) AS f1_recbmto,
    max(NULLIF(f1.f1_dtdigit, '')) AS f1_dtdigit,
    COALESCE(json_agg(json_build_object(
        'doc', d1.d1_doc,
        'serie', d1.d1_serie,
        'recbmto', CASE WHEN f1.f1_recbmto <> '' AND f1.f1_recbmto ~ '^[0-9]{8}$' THEN TO_CHAR(TO_DATE(f1.f1_recbmto, 'YYYYMMDD'), 'YYYY-MM-DD') ELSE NULL END,
        'qtd', d1.d1_quant,
        'vunit', d1.d1_vunit,
        'total', d1.d1_total
    )), '[]'::json) AS details_json
  FROM sd1010 d1
  JOIN sf1010 f1
    ON f1.f1_filial  = d1.d1_filial
   AND f1.f1_doc     = d1.d1_doc
   AND f1.f1_serie   = d1.d1_serie
   AND f1.f1_fornece = d1.d1_fornece
   AND f1.f1_loja    = d1.d1_loja
   AND (f1.d_e_l_e_t_ = '' OR f1.d_e_l_e_t_ = ' ')
  WHERE (d1.d_e_l_e_t_ = '' OR d1.d_e_l_e_t_ = ' ')
    AND d1.d1_filial = pc.c7_filial
    AND d1.d1_pedido = pc.c7_num
    AND d1.d1_itempc = pc.c7_item
) nf ON pc.c7_num IS NOT NULL AND pc.c7_num <> ''
LEFT JOIN sc2010 c2
  ON c2.c2_filial = sc.c1_filial
 AND c2.c2_num = SUBSTRING(TRIM(sc.sc_op_origem_raw), 1, 6)
 AND c2.c2_item = SUBSTRING(TRIM(sc.sc_op_origem_raw), 7, 2)
 AND c2.c2_sequen = SUBSTRING(TRIM(sc.sc_op_origem_raw), 9, 3)
 AND (c2.d_e_l_e_t_ = '' OR c2.d_e_l_e_t_ = ' ')
LEFT JOIN sc5010 c5a
  ON c5a.c5_filial = sc.c1_filial
 AND c5a.c5_num = sc.sc_pedido_origem_raw
 AND (c5a.d_e_l_e_t_ = '' OR c5a.d_e_l_e_t_ = ' ')
LEFT JOIN sc5010 c5b
  ON c5b.c5_filial = sc.c1_filial
 AND c5b.c5_num = COALESCE(
       NULLIF(TRIM(c2.c2_pedido), ''),
       CASE 
         WHEN TRIM(c2.c2_obs) ~ '^[0-9]+' THEN LPAD(SUBSTRING(TRIM(c2.c2_obs) FROM '^[0-9]+'), 6, '0')
         ELSE ''
       END
     )
 AND (c5b.d_e_l_e_t_ = '' OR c5b.d_e_l_e_t_ = ' ')
LEFT JOIN sa1010 sa1a
  ON sa1a.a1_filial = '  '
 AND sa1a.a1_cod = c5a.c5_cliente
 AND sa1a.a1_loja = c5a.c5_lojacli
 AND (sa1a.d_e_l_e_t_ = '' OR sa1a.d_e_l_e_t_ = ' ')
LEFT JOIN sa1010 sa1b
  ON sa1b.a1_filial = '  '
 AND sa1b.a1_cod = c5b.c5_cliente
 AND sa1b.a1_loja = c5b.c5_lojacli
 AND (sa1b.d_e_l_e_t_ = '' OR sa1b.d_e_l_e_t_ = ' ')
${finalWhereClause}
ORDER BY sc.c1_filial, sc.c1_num, sc.c1_item
LIMIT $${paramCount++} OFFSET $${paramCount++};
        `;

        params.push(limitVal);
        params.push(offsetVal);

        const result = await db.query(sql, params);

        const canViewFinancials = await hasFinancialAccess(req);
        const rows = canViewFinancials
            ? result.rows
            : result.rows.map((row) => ({
                ...row,
                details_json: Array.isArray(row.details_json)
                    ? row.details_json.map(({ vunit, total, ...restDetail }) => restDetail)
                    : row.details_json
            }));

        res.json(rows);

    } catch (err) {
        console.error('Erro ao buscar fluxo completo de compras:', err);
        res.status(500).json({ error: 'Erro ao buscar fluxo completo de compras', details: err.message });
    }
});

module.exports = router;
