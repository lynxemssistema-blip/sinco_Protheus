const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const db = require('../server/db');
const mysqlPool = require('../server/services/mysqlService');

async function checkItem() {
    console.log('--- DB Check for Pedido 005187 / Item 01 / MT3-15148 ---');
    try {
        // Query Postgres
        const pgRes = await db.query(`
            SELECT 
                TRIM(c6.c6_num) as pedido,
                TRIM(c6.c6_item) as item,
                TRIM(c6.c6_produto) as codigo,
                TRIM(c6.c6_xrevm) as rev_codigo,
                TRIM(c6.c6_xrevc) as c6_rev_cliente,
                sb1.b1_desc as descricao,
                TRIM(sb1.b1_msblql) as b1_msblql
            FROM sc6010 c6
            LEFT JOIN sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE c6.c6_num = '005187' AND c6.c6_item = '01' AND COALESCE(c6.d_e_l_e_t_, '') = ''
        `);
        console.log('PG SC6/SB1:', pgRes.rows);

        if (pgRes.rows.length > 0) {
            const cod = pgRes.rows[0].codigo;

            // Check sz0010 (restrições)
            const sz0Res = await db.query(`
                SELECT TRIM(z0_produto) as cod, z0_status, d_e_l_e_t_
                FROM sz0010
                WHERE TRIM(z0_produto) = $1
            `, [cod]);
            console.log('PG SZ0010:', sz0Res.rows);

            // Check sg1010 (engenharia)
            const sg1Res = await db.query(`
                SELECT TRIM(g1_cod) as cod, d_e_l_e_t_
                FROM sg1010
                WHERE TRIM(g1_cod) = $1 AND COALESCE(d_e_l_e_t_, '') = ''
            `, [cod]);
            console.log('PG SG1010:', sg1Res.rows);

            // Check sg2010 (roteiro)
            const sg2Res = await db.query(`
                SELECT TRIM(g2_produto) as cod, d_e_l_e_t_
                FROM sg2010
                WHERE TRIM(g2_produto) = $1 AND COALESCE(d_e_l_e_t_, '') = ''
            `, [cod]);
            console.log('PG SG2010 (Roteiro):', sg2Res.rows);
        }

        // Check MySQL engineering releases
        const [mysqlRes] = await mysqlPool.query(`
            SELECT * FROM app_engineering_releases WHERE UPPER(TRIM(codigo_produto)) = 'MT3-15148'
        `);
        console.log('MySQL engineering releases:', mysqlRes);

    } catch (err) {
        console.error('Error running check:', err);
    } finally {
        process.exit(0);
    }
}

checkItem();
