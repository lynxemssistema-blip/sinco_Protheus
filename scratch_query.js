require('dotenv').config({path: './server/.env'});
const mysql = require('./server/services/mysqlService');
const db = require('./server/db');

async function test() {
    const matrixQuery = `
        SELECT 
            TRIM(c2.c2_num) as op, 
            TRIM(c2.c2_item) as item_op, 
            TRIM(c2.c2_sequen) as sequen, 
            TRIM(g2.g2_operac) as operacao, 
            TRIM(g2.g2_recurso) as recurso 
        FROM public.sc2010 c2 
        INNER JOIN public.sg2010 g2 ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto) 
        WHERE TRIM(c2.c2_num) = '003595' AND TRIM(c2.c2_sequen) = '020'
    `;
    const pgRes = await db.query(matrixQuery);
    console.log(pgRes.rows);
    process.exit(0);
}
test();
