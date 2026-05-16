const db = require('./db');

async function debugOrder(pedidoNum) {
    try {
        console.log(`Checking SC5 for order: ${pedidoNum}`);
        const sc5 = await db.query(`
            SELECT c5_num, c5_tipo, c5_liberok, c5_nota, d_e_l_e_t_, c5_filial, c5_cliente
            FROM sc5010 
            WHERE c5_num LIKE $1
        `, [`%${pedidoNum}%`]);

        console.log('SC5 Results:', sc5.rows);

        if (sc5.rows.length > 0) {
            const filial = sc5.rows[0].c5_filial;
            const num = sc5.rows[0].c5_num;

            console.log(`\nChecking SC6 for order: ${num} (Filial: ${filial})`);
            const sc6 = await db.query(`
                SELECT c6_item, c6_produto, c6_qtdven, c6_qtdent, d_e_l_e_t_, c6_filial, c6_num
                FROM sc6010
                WHERE c6_num = $1 AND c6_filial = $2
            `, [num, filial]);

            console.log('SC6 Results:', sc6.rows.map(r => ({
                item: r.c6_item,
                produto: r.c6_produto,
                qtdven: r.c6_qtdven,
                qtdent: r.c6_qtdent,
                delete: r.d_e_l_e_t_,
                saldo: r.c6_qtdven - r.c6_qtdent
            })));
        }
    } catch (err) {
        console.error('Debug error:', err);
    } finally {
        process.exit();
    }
}

debugOrder('002553');
