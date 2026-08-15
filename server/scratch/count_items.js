require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function main() {
    try {
        console.log('--- POSTGRESQL COUNT FOR PEDIDO 004159 ---');

        // Total items
        const total = await pool.query(
            "SELECT count(*) FROM sc6010 WHERE c6_num = '004159' AND COALESCE(d_e_l_e_t_, '') = ''"
        );
        console.log('Total SC6010 items (not deleted):', total.rows[0].count);

        // Active items (Saldo > 0)
        const active = await pool.query(
            "SELECT count(*) FROM sc6010 WHERE c6_num = '004159' AND COALESCE(d_e_l_e_t_, '') = '' AND ((c6_qtdven - c6_qtdent) > 0 OR c6_qtdlib > 0)"
        );
        console.log('Active items (Saldo > 0):', active.rows[0].count);

        // Active PCP items
        const activePcp = await pool.query(`
            SELECT count(*) 
            FROM sc6010 c6
            WHERE c6_num = '004159' 
              AND COALESCE(d_e_l_e_t_, '') = '' 
              AND ((c6_qtdven - c6_qtdent) > 0 OR c6_qtdlib > 0)
              AND (NOT (
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
            ))
        `);
        console.log('Active PCP items:', activePcp.rows[0].count);

        // List active items
        const listActive = await pool.query(
            "SELECT c6_item, c6_produto, (c6_qtdven - c6_qtdent) as saldo FROM sc6010 WHERE c6_num = '004159' AND COALESCE(d_e_l_e_t_, '') = '' AND ((c6_qtdven - c6_qtdent) > 0 OR c6_qtdlib > 0) ORDER BY c6_item"
        );
        console.log('\nList of all Active Items (Saldo > 0):');
        listActive.rows.forEach(r => {
            console.log(`Item: ${r.c6_item} | Prod: ${r.c6_produto} | Saldo: ${r.saldo}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
