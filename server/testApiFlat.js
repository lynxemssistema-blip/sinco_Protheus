require('dotenv').config();
const db = require('./db');
const mysqlPool = require('./services/mysqlService');

(async () => {
    let forecastJson = '[]';
    try {
        const [forecastRows] = await mysqlPool.query(`
            SELECT TRIM(pedido) as pedido, TRIM(item) as item, 
                   MAX(data_entrega_pcp) as data_entrega_pcp, 
                   MAX(data_prevista_faturamento) as data_prevista_faturamento 
            FROM app_pcp_delivery_forecasts
            WHERE pedido IS NOT NULL AND item IS NOT NULL
            GROUP BY TRIM(pedido), TRIM(item)
            LIMIT 5000
        `);
        if (forecastRows.length > 0) {
            forecastJson = JSON.stringify(forecastRows.map(row => ({
                pedido: row.pedido,
                item: row.item,
                data_entrega_pcp: row.data_entrega_pcp || null,
                data_prevista_faturamento: row.data_prevista_faturamento || null
            })));
        }
    } catch(err) {
        console.log('mysql err', err.message);
    }

    const req = {
        query: {
            only_active: 'true',
            page: 1,
            limit: 50,
            sortBy: 'emissao',
            sortOrder: 'DESC'
        }
    };
    
    // Simulate the endpoint logic
    try {
        const { cliente, pedido, produto, pedcli, dataInicial, dataFinal, dateType = 'pedido', page = 1, limit = 50, only_active = 'false', tipo_item = '', pcpDataInicial = '', pcpDataFinal = '', pcpDateFilter = 'false', op_status = '', sortBy = 'emissao', sortOrder = 'DESC' } = req.query;
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        let params = [forecastJson];
        let paramCount = 2;

        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''";
        // mock getInactiveFilter
        whereClause += " AND c5.c5_num NOT IN ('DUMMY')";

        if (only_active === 'true') {
            whereClause += ` AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)`;
        }

        let orderClauseInner = `ORDER BY c5.c5_emissao DESC, c5.c5_num DESC, c6.c6_item ASC`;
        let orderClauseOuter = `ORDER BY pi.emissao DESC, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;

        const query = `
            WITH paged_items AS (
                SELECT
                    COUNT(*) OVER() AS full_count,
                    TRIM(c5.c5_num) as pedido,
                    TRIM(c5.c5_cliente) as cod_cliente,
                    TRIM(c5.c5_lojacli) as loja_cliente,
                    NULLIF(TRIM(COALESCE(c5.c5_mennota, '') || ' ' || COALESCE(c5.c5_zobs, '') || ' ' || COALESCE(c5.c5_zobsorc, '')), '') AS observacoes_gerais,
                    c5.c5_emissao as emissao,
                    c5.c5_orcres as orcamento,
                    TRIM(c6.c6_item) as item,
                    TRIM(c6.c6_produto) as codigo,
                    TRIM(c6.c6_xrevm) as rev_codigo,
                    TRIM(c6.c6_xrevc) as c6_rev_cliente,
                    c6.c6_um as unidade,
                    COALESCE(c6.c6_qtdven, 0)::numeric(18,6) as quantidade,
                    COALESCE(c6.c6_qtdent, 0)::numeric(18,6) as qtd_entreg,
                    (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) as qtd_faturar,
                    c6.c6_prcven::numeric(18,2) as valor_unitario,
                    c6.c6_valor::numeric(18,2) as valor_total,
                    TRIM(COALESCE(c6.c6_entreg, '')) as entrega,
                    c6.c6_pedcli as ped_cliente,
                    c5.c5_liberok as status_cor,
                    fc.data_entrega_pcp,
                    fc.data_prevista_faturamento
                FROM public.sc5010 c5
                JOIN public.sc6010 c6
                    ON COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND c6.c6_filial = c5.c5_filial
                    AND c6.c6_num = c5.c5_num
                LEFT JOIN jsonb_to_recordset($1::jsonb) AS fc(pedido varchar, item varchar, data_entrega_pcp varchar, data_prevista_faturamento varchar)
                    ON fc.pedido = TRIM(c5.c5_num) AND fc.item = TRIM(c6.c6_item)
                ${whereClause}
                ${orderClauseInner}
                LIMIT $2 OFFSET $3
            )
            SELECT
                pi.*,
                'PCP' AS status_tipo_item,
                TRIM(c2.c2_num) AS op_num,
                c2.c2_quant::numeric(18,6) AS op_qtd
            FROM paged_items pi
            LEFT JOIN public.sc2010 c2
                ON TRIM(c2.c2_pedido) = pi.pedido
                AND TRIM(c2.c2_itempv) = pi.item
                AND c2.c2_sequen = '001'
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            ${orderClauseOuter}
        `;

        params.push(limitParsed, offset);

        const pgClient = await db.connect();
        let result;
        try {
            await pgClient.query("SET LOCAL statement_timeout = '120000'");
            result = await pgClient.query(query, params);
        } finally {
            pgClient.release();
        }
        console.log(`Query returned ${result.rows.length} rows.`);

        // Test enrichment step
        if (result.rows.length > 0) {
            const productCodes = [...new Set(result.rows.map(i => i.codigo).filter(c => c))];
            console.log('productCodes:', productCodes.length);
            const CHUNK = 150;
            const chunks = [];
            for (let i = 0; i < productCodes.length; i += CHUNK) chunks.push(productCodes.slice(i, i + CHUNK));
            const allRows = (await Promise.all(chunks.map(chunk => {
                const ph = chunk.map(() => '?').join(',');
                return mysqlPool.execute(`SELECT DISTINCT TRIM(produto_codigo) as produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${ph})`, chunk).then(([r]) => r);
            }))).flat();
            console.log('Enrichment docs succeeded');
        }

        console.log('All done');

    } catch(err) {
        console.error('API ERROR:', err);
    }
    process.exit();
})();
