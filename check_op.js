const db = require('./server/db');

async function test() {
    const pgClient = await db.connect();
    try {
        const query = `
            SELECT 
                c2_num,
                c2_item,
                c2_sequen,
                c2_produto,
                c2_pedido,
                TRIM(c2_num) AS op_num,
                TRIM(c2_pedido) AS pedido
            FROM public.sc2010
            WHERE c2_num LIKE '%006171%'
        `;
        const res = await pgClient.query(query);
        console.log('Result:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        pgClient.release();
        process.exit(0);
    }
}
test();
