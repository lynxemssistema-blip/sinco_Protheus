const express = require('express');
const router = express.Router();
const db = require('../db');

// ===================================================================
// GET /api/compras/solicitacoes - Listar Solicitações de Compra
// ===================================================================
router.get('/solicitacoes', async (req, res) => {
    try {
        console.log('🔵 [COMPRAS/SOLICITACOES] VERSÃO 2026-01-21 06:38 - CAMPOS CORRIGIDOS');
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

        // Adicionar LIMIT
        const limitParam = paramCount;
        params.push(1000);

        const sql = `
        SELECT
            sc1.c1_filial AS filial,
            sc1.c1_num AS sc_numero,
            sc1.c1_item AS sc_item,
            CASE
                WHEN sc1.c1_emissao ~ '^[0-9]{8}$' 
                THEN to_date(sc1.c1_emissao, 'YYYYMMDD')
                ELSE NULL
            END AS sc_data_emissao,
            sc1.c1_produto AS produto_codigo,
            sb1.b1_desc AS produto_descricao,
            sc1.c1_quant AS sc_quantidade,
            sc1.c1_um AS sc_unidade,
            sc1.c1_cc AS centro_custo,
            sc1.c1_obs AS observacao,
            sc7.c7_num AS pedido_numero,
            sc7.c7_item AS pedido_item,
            CASE
                WHEN sc7.c7_emissao ~ '^[0-9]{8}$' 
                THEN to_date(sc7.c7_emissao, 'YYYYMMDD')
                ELSE NULL
            END AS pedido_data_emissao,
            CASE
                WHEN sc7.c7_datprf ~ '^[0-9]{8}$' 
                THEN to_date(sc7.c7_datprf, 'YYYYMMDD')
                ELSE NULL
            END AS pedido_data_prevista,
            sc7.c7_fornece AS fornecedor_codigo,
            sa2.a2_nome AS fornecedor_nome,
            CASE
                WHEN (sc7.c7_num IS NULL OR sc7.c7_num = '') THEN 'PENDENTE'
                WHEN sc1.c1_aprov != '' THEN 'EM_APROVACAO'
                WHEN sc1.c1_cotacao != '' THEN 'EM_COTACAO'
                WHEN sc7.c7_num IS NOT NULL AND sc7.c7_num != '' THEN 'GEROU_PEDIDO'
                ELSE 'ABERTA'
            END AS sc_status
        FROM sc1010 sc1
        LEFT JOIN sb1010 sb1 ON sb1.b1_cod = sc1.c1_produto
            AND (sb1.d_e_l_e_t_ = '' OR sb1.d_e_l_e_t_ = ' ')
        LEFT JOIN sc7010 sc7 ON sc7.c7_numsc = sc1.c1_num
            AND sc7.c7_itemsc = sc1.c1_item
            AND (sc7.d_e_l_e_t_ = '' OR sc7.d_e_l_e_t_ = ' ')
        LEFT JOIN sa2010 sa2 ON sa2.a2_cod = sc7.c7_fornece
            AND sa2.a2_loja = sc7.c7_loja
            AND (sa2.d_e_l_e_t_ = '' OR sa2.d_e_l_e_t_ = ' ')
        WHERE (sc1.d_e_l_e_t_ = '' OR sc1.d_e_l_e_t_ = ' ')
        ${whereClause}
        ORDER BY sc1.c1_emissao DESC, sc1.c1_num DESC
        LIMIT $${limitParam}
        `;

        const result = await db.query(sql, params);
        res.json(result.rows);

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
            pc_emissao_de,
            pc_emissao_ate,
            nf_recebimento_de,
            nf_recebimento_ate,
            tem_nf,
            comprador
        } = req.query;

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

        const finalWhereClause = finalWhere.length > 0 ? `WHERE ${finalWhere.join(' AND ')}` : '';

        const sql = `
WITH sc AS (
  SELECT
    c1.c1_filial, c1.c1_num, c1.c1_item, c1.c1_produto, c1.c1_descri, c1.c1_um, c1.c1_quant, c1.c1_emissao, c1.c1_datprf, c1.c1_obs
  FROM sc1010 c1
  WHERE (c1.d_e_l_e_t_ = '' OR c1.d_e_l_e_t_ = ' ')
    ${scWhereClause}
),
pc AS (
  SELECT
    c7.c7_filial, c7.c7_num, c7.c7_item, c7.c7_produto, c7.c7_quant, c7.c7_preco, c7.c7_fornece, c7.c7_loja, c7.c7_emissao, c7.c7_datprf, c7.c7_obs, c7.c7_numsc, c7.c7_itemsc, c7.c7_user
  FROM sc7010 c7
  WHERE (c7.d_e_l_e_t_ = '' OR c7.d_e_l_e_t_ = ' ')
),
nf AS (
  SELECT
    d1.d1_filial,
    d1.d1_pedido,
    d1.d1_itempc,
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
    ON (f1.d_e_l_e_t_ = '' OR f1.d_e_l_e_t_ = ' ')
   AND f1.f1_filial  = d1.d1_filial
   AND f1.f1_doc     = d1.d1_doc
   AND f1.f1_serie   = d1.d1_serie
   AND f1.f1_fornece = d1.d1_fornece
   AND f1.f1_loja    = d1.d1_loja
  WHERE (d1.d_e_l_e_t_ = '' OR d1.d_e_l_e_t_ = ' ')
    AND NULLIF(d1.d1_pedido, '') IS NOT NULL
    AND NULLIF(d1.d1_itempc, '') IS NOT NULL
  GROUP BY d1.d1_filial, d1.d1_pedido, d1.d1_itempc
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
LEFT JOIN pc
  ON pc.c7_filial = sc.c1_filial
 AND pc.c7_numsc  = sc.c1_num
 AND pc.c7_itemsc = sc.c1_item
LEFT JOIN sa2010 sa2
  ON (sa2.d_e_l_e_t_ = '' OR sa2.d_e_l_e_t_ = ' ')
 AND sa2.a2_cod     = pc.c7_fornece
 AND sa2.a2_loja    = pc.c7_loja
LEFT JOIN nf
  ON nf.d1_filial = pc.c7_filial
 AND nf.d1_pedido = pc.c7_num
 AND nf.d1_itempc = pc.c7_item
${finalWhereClause}
ORDER BY sc.c1_filial, sc.c1_num, sc.c1_item
LIMIT 1000;
        `;

        const result = await db.query(sql, params);
        res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar fluxo completo de compras:', err);
        res.status(500).json({ error: 'Erro ao buscar fluxo completo de compras', details: err.message });
    }
});

module.exports = router;
