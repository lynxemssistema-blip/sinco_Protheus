const mysql = require('mysql2/promise');
const { Pool } = require('pg');

async function test() {
    try {
        const mysqlPool = mysql.createPool({
            host: 'metalfisa.mysql.uhserver.com',
            user: 'ronaldo2',
            password: 'jHAzhFG848@yN@U',
            database: 'metalfisa',
            port: 3306
        });
        const [rows] = await mysqlPool.query('SELECT * FROM app_romaneio_items WHERE id = 213');
        console.log('MySQL Item 213:', rows[0]);

        const pgPool = new Pool({
            user: 'sinco2',
            password: 'sinco25',
            host: '192.168.1.61',
            port: 5432,
            database: 'p12prd'
        });
        
        if (rows[0] && rows[0].pedido) {
            const pedido = rows[0].pedido;
            const item_pedido = rows[0].item_pedido;
            
            const pgQuery = `
                SELECT TRIM(c2_num) as op_numero, TRIM(c2_item) as op_item, TRIM(c2_sequen) as op_sequencia
                FROM public.sc2010
                WHERE (
                    (REPLACE(TRIM(c2_pedido), ' ', '') = REPLACE(TRIM($1), ' ', '') AND REPLACE(TRIM(c2_itempv), ' ', '') = REPLACE(TRIM($2), ' ', ''))
                    OR (TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen) = REPLACE(TRIM($1), ' ', ''))
                )
                AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                LIMIT 1
            `;
            const pgRes = await pgPool.query(pgQuery, [pedido.trim(), item_pedido?.trim() || '']);
            console.log('Postgres OPs:', pgRes.rows);
        }

        mysqlPool.end();
        pgPool.end();
    } catch(e) {
        console.error(e);
    }
}
test();
