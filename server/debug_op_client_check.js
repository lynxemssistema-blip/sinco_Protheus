const db = require('./db');

async function debug() {
    try {
        console.log('🔍 validating SC5010 for Pedido 002663...');

        const res = await db.query(`
            SELECT c5_num, c5_filial, c5_cliente, c5_lojacli 
            FROM public.sc5010 
            WHERE c5_num = '002663'
        `);
        console.log('SC5010:', res.rows);

        if (res.rows.length > 0) {
            const client = await db.query(`
                SELECT a1_cod, a1_loja, a1_nome 
                FROM public.sa1010
                WHERE a1_cod = '${res.rows[0].c5_cliente}' AND a1_loja = '${res.rows[0].c5_lojacli}'
            `);
            console.log('SA1010:', client.rows);
        }

    } catch (err) {
        console.error(err);
    }
}

debug();
