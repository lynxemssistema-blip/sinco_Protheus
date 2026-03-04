const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

async function checkOrder() {
    try {
        const orderNum = '002730';
        console.log(`Checking order ${orderNum}...`);

        // SC5 = Cabecalho, SC6 = Itens
        const res = await pool.query(`
            SELECT 
                TRIM(C6_NUM) as pedido,
                TRIM(C6_ITEM) as item,
                TRIM(C6_PRODUTO) as produto,
                TRIM(C6_DESCRI) as descricao,
                C6_QTDVEN as qtd
            FROM sc6010 
            WHERE TRIM(C6_NUM) = $1
            AND COALESCE(D_E_L_E_t_, '') = ''
        `, [orderNum]);

        console.log('Items found:', res.rows.length);
        console.table(res.rows);

        pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkOrder();
