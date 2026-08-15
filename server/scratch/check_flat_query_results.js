require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const { Pool } = require('pg');
const mysql = require('mysql2/promise');

const pgPool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function main() {
    // Setup MySQL
    const mysqlPool = await mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD || process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
    });

    try {
        console.log('--- ELASTIC SIMULATION OF /flat QUERY FOR PEDIDO 004159 ---');

        // Parameters
        const only_active = 'false';
        const tipo_item = 'PCP';
        const pedido = '004159';
        const limitParsed = 50;
        const pageParsed = 1;
        const offset = 0;

        // Inactive orders filter
        let inactiveFilterSql = '';
        try {
            const [settings] = await mysqlPool.query(
                "SELECT setting_value FROM app_settings WHERE setting_key = 'hide_inactive_orders'"
            );
            let isEnabled = true;
            if (settings && settings.length > 0) {
                isEnabled = settings[0].setting_value === 'true';
            }
            if (isEnabled) {
                const [rows] = await mysqlPool.query("SELECT pedido_numero FROM app_pedidos_inativos");
                if (rows && rows.length > 0) {
                    const pedList = rows.map(r => `'${r.pedido_numero.trim()}'`);
                    inactiveFilterSql = ` AND TRIM(BOTH FROM c5.c5_num) <> ALL (ARRAY[${pedList.join(', ')}]::text[]) `;
                }
            }
        } catch (e) {
            console.warn('Inactive filter skip:', e.message);
        }

        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''" + inactiveFilterSql;
        let params = [];
        let paramCount = 1;

        if (only_active === 'true') {
            whereClause += ` AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)`;
        }

        // Pedido filter
        whereClause += ` AND TRIM(c5.c5_num) = $${paramCount}`;
        params.push(pedido);
        paramCount++;

        // Tipo item PCP filter
        if (tipo_item === 'PCP') {
            whereClause += ` AND (NOT (
                EXISTS (
                    SELECT 1 FROM public.sb1010 filter_sb
                    WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                    AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                    AND filter_sb.b1_msblql IN ('1','S','T','Y')
                ) OR EXISTS (
                    SELECT 1 FROM public.sz0010 filter_sz
                    WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                    AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                    AND filter_sz.z0_status = 'P'
                )
            ) AND COALESCE(c6.c6_xrevm, '') = COALESCE(c6.c6_xrevc, '') 
              AND (
                EXISTS (
                    SELECT 1 FROM public.sg1010 sg1
                    WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                    AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                ) OR EXISTS (
                    SELECT 1 FROM public.sg2010 sg2
                    WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                    AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                )
            ))`;
        }

        const query = `
            WITH paged_base AS (
                SELECT
                    c5.c5_num,
                    c5.c5_cliente,
                    c5.c5_lojacli,
                    c5.c5_mennota,
                    c5.c5_zobs,
                    c5.c5_zobsorc,
                    c5.c5_emissao,
                    c5.c5_orcres,
                    c5.c5_liberok,
                    c6.c6_item,
                    c6.c6_produto,
                    c6.c6_xrevm,
                    c6.c6_xrevc,
                    c6.c6_um,
                    c6.c6_qtdven,
                    c6.c6_qtdent,
                    c6.c6_prcven,
                    c6.c6_valor,
                    c6.c6_entreg,
                    c6.c6_pedcli,
                    NULL::timestamp as data_entrega_pcp, NULL::timestamp as data_prevista_faturamento
                FROM public.sc5010 c5
                JOIN public.sc6010 c6
                    ON COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND c6.c6_filial = c5.c5_filial
                    AND c6.c6_num = c5.c5_num
                ${whereClause}
                ORDER BY c5.c5_emissao DESC, c5.c5_num DESC, c6.c6_item ASC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            ),
            paged_items AS (
                SELECT
                    TRIM(pb.c5_num) as pedido,
                    TRIM(pb.c5_cliente) as cod_cliente,
                    TRIM(pb.c5_lojacli) as loja_cliente,
                    sa1.a1_nome as nome_cliente,
                    pb.c5_emissao as emissao,
                    TRIM(pb.c6_item) as item,
                    TRIM(pb.c6_produto) as codigo,
                    COALESCE(pb.c6_qtdven, 0)::numeric(18,6) as quantidade,
                    COALESCE(pb.c6_qtdent, 0)::numeric(18,6) as qtd_entreg,
                    (COALESCE(pb.c6_qtdven, 0) - COALESCE(pb.c6_qtdent, 0))::numeric(18,6) as qtd_faturar,
                    TRIM(COALESCE(pb.c6_entreg, '')) as entrega,
                    pb.data_entrega_pcp,
                    pb.data_prevista_faturamento
                FROM paged_base pb
                LEFT JOIN public.sa1010 sa1
                    ON sa1.a1_cod = pb.c5_cliente
                    AND sa1.a1_loja = pb.c5_lojacli
                    AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                LEFT JOIN public.sb1010 sb1
                    ON sb1.b1_cod = pb.c6_produto
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            )
            SELECT
                pi.*,
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) AS op_num_completa
            FROM paged_items pi
            LEFT JOIN public.sc2010 c2
                ON TRIM(c2.c2_pedido) = pi.pedido
                AND TRIM(c2.c2_itempv) = pi.item
                AND c2.c2_sequen = '001'
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            ORDER BY pi.pedido DESC, pi.item ASC
        `;

        params.push(limitParsed + 1, offset);
        
        console.log('Executing PG query with params:', params);
        const result = await pgPool.query(query, params);
        console.log(`PG Query returned ${result.rows.length} rows.`);

        // Log first 10 rows
        console.log('\n--- FIRST 10 ROWS RETURNED BY POSTGRES ---');
        result.rows.slice(0, 10).forEach((r, idx) => {
            console.log(`${idx + 1}. Item: ${r.item} | Prod: ${r.codigo} | Qtd: ${r.quantidade} | Saldo: ${r.qtd_faturar} | OP: ${r.op_num || '-'}`);
        });

        // Search for Item 01
        const item01RowIndex = result.rows.findIndex(r => r.item === '01');
        console.log('\nItem 01 index in raw rows:', item01RowIndex);

        // Fetch priorities from MySQL
        const opNumerosUnicos = [...new Set(result.rows.map(r => r.op_num_completa).filter(Boolean))];
        const opPrefixosUnicos = [...new Set(opNumerosUnicos.map(op => op.substring(0, 8)))];
        const opsToCheck = [...new Set([...opNumerosUnicos, ...opPrefixosUnicos])];

        let priorityMap = {};
        if (opsToCheck.length > 0) {
            const placeholders = opsToCheck.map(() => '?').join(',');
            const [opPrioritiesRows] = await mysqlPool.execute(
                `SELECT op_numero, prioridade FROM app_op_priorities WHERE op_numero IN (${placeholders})`,
                opsToCheck
            );
            opPrioritiesRows.forEach(r => { priorityMap[r.op_numero] = r.prioridade; });
        }

        result.rows.forEach(r => {
            const op = r.op_num_completa;
            if (!op) {
                r.op_prioridade = 0;
                return;
            }
            const prefix = op.substring(0, 8);
            r.op_prioridade = priorityMap[op] || priorityMap[prefix] || 0;
        });

        // Log priorities of returned rows
        console.log('\n--- PRIORITIES FOR THE RAW ROWS ---');
        result.rows.forEach(r => {
            if (r.op_prioridade > 0 || r.item === '01') {
                console.log(`Item: ${r.item} | OP: ${r.op_num || '-'} | Priority: ${r.op_prioridade} | Saldo: ${r.qtd_faturar}`);
            }
        });

        // Now sort by priority (just like backend line 1456)
        const finalRows = [...result.rows];
        finalRows.sort((a, b) => (b.op_prioridade || 0) - (a.op_prioridade || 0));

        console.log('\n--- AFTER SORTING BY PRIORITY (FIRST 15 ROWS) ---');
        finalRows.slice(0, 15).forEach((r, idx) => {
            console.log(`${idx + 1}. Item: ${r.item} | Prod: ${r.codigo} | Qtd: ${r.quantidade} | Saldo: ${r.qtd_faturar} | OP: ${r.op_num || '-'} | Priority: ${r.op_prioridade}`);
        });

        // Slice to limitParsed (50)
        const pageData = finalRows.slice(0, limitParsed);
        console.log(`\nPage Data length: ${pageData.length}`);
        const finalItem01 = pageData.find(r => r.item === '01');
        console.log('Is Item 01 in the final sliced pageData (first 50 items)?', finalItem01 ? 'YES' : 'NO');

    } catch (e) {
        console.error('Error executing simulation:', e);
    } finally {
        await pgPool.end();
        await mysqlPool.end();
    }
}

main();
