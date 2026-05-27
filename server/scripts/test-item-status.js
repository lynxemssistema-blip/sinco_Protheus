require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function test() {
    try {
        const pedido = '4856';
        console.log('Connecting to DB...');
        const testConn = await db.query('SELECT 1 as ok');
        console.log('DB connection OK:', testConn.rows);

        const itemsResult = await db.query(
            `SELECT TRIM(c6.c6_item) AS item, TRIM(c6.c6_produto) AS codigo,
                    TRIM(c6.c6_xrevm) AS rev_codigo, TRIM(c6.c6_xrevc) AS c6_rev_cliente,
                    COALESCE(sb1.b1_msblql, '') AS b1_msblql
             FROM public.sc5010 c5
             JOIN public.sc6010 c6 ON COALESCE(c6.d_e_l_e_t_, '') = '' AND c6.c6_filial = c5.c5_filial AND c6.c6_num = c5.c5_num
             LEFT JOIN public.sb1010 sb1 ON COALESCE(sb1.d_e_l_e_t_, '') = '' AND TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
             WHERE c5.c5_num = $1 AND COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B'
             ORDER BY c6.c6_item ASC`,
            [pedido]
        );

        const items = itemsResult.rows;
        console.log('Items found:', items.length);
        if (items.length === 0) { console.log('No items for pedido', pedido); process.exit(0); }

        const productCodes = [...new Set(items.map(i => i.codigo).filter(Boolean))];
        console.log('Product codes:', productCodes);

        const pgStatusResult = await db.query(
            `SELECT 'sg1' AS type, TRIM(g1_cod) AS cod FROM public.sg1010 WHERE TRIM(g1_cod) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
             UNION ALL
             SELECT 'sg2' AS type, TRIM(g2_produto) AS cod FROM public.sg2010 WHERE TRIM(g2_produto) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
             UNION ALL
             SELECT 'sz0' AS type, TRIM(z0_produto) AS cod FROM public.sz0010 WHERE TRIM(z0_produto) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'`,
            [productCodes]
        );

        const sg1Set = new Set(), sg2Set = new Set(), sz0Set = new Set();
        pgStatusResult.rows.forEach(r => {
            if (r.type === 'sg1') sg1Set.add(r.cod);
            if (r.type === 'sg2') sg2Set.add(r.cod);
            if (r.type === 'sz0') sz0Set.add(r.cod);
        });

        console.log('\n=== STATUS DIAGNOSIS FOR PEDIDO', pedido, '===');
        items.forEach(item => {
            const isBlocked      = ['1','S','T','Y'].includes(item.b1_msblql);
            const hasRestriction = sz0Set.has(item.codigo);
            const revDiff        = (item.rev_codigo || '') !== (item.c6_rev_cliente || '');
            const isNew          = !sg1Set.has(item.codigo) && !sg2Set.has(item.codigo);
            let status;
            if (isBlocked || hasRestriction) status = 'Restricao';
            else if (revDiff) status = 'Revisao';
            else if (isNew)   status = 'Novo';
            else              status = 'PCP';

            console.log(`Item: ${item.item} | Cod: ${item.codigo} | msblql: "${item.b1_msblql}" | rev_cod: "${item.rev_codigo}" | rev_cli: "${item.c6_rev_cliente}" | revDiff: ${revDiff} | isNew: ${isNew} | hasSZ0: ${hasRestriction} | => STATUS: ${status}`);
        });

    } catch (e) {
        console.error('ERROR:', e.message);
    }
    process.exit(0);
}
test();
