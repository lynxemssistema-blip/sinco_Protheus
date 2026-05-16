const db = require('./db');

async function debugOrder(pedidoNum) {
    try {
        const sc5 = await db.query(`
            SELECT c5_num, c5_tipo, c5_liberok, c5_nota, d_e_l_e_t_, c5_filial, c5_cliente
            FROM sc5010 
            WHERE c5_num LIKE $1
        `, [`%${pedidoNum}%`]);

        if (sc5.rows.length > 0) {
            const num = sc5.rows[0].c5_num;
            const filial = sc5.rows[0].c5_filial;

            const sc6 = await db.query(`
                SELECT c6_item, c6_produto, c6_qtdven, c6_qtdent, c6_qtdlib, d_e_l_e_t_
                FROM sc6010
                WHERE c6_num = $1 AND c6_filial = $2
            `, [num, filial]);

            console.log('Detailed SC6 Results:');
            console.table(sc6.rows.map(r => ({
                item: r.c6_item,
                produto: r.c6_produto,
                qtdven: r.c6_qtdven,
                qtdent: r.c6_qtdent,
                qtdlib: r.c6_qtdlib,
                saldo: r.c6_qtdven - r.c6_qtdent,
                delete: r.d_e_l_e_t_
            })));
        }
    } catch (err) {
        console.error('Debug error:', err);
    } finally {
        process.exit();
    }
}

debugOrder('002553');
