
require('dotenv').config();
const { Pool } = require('pg');

const db = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function main() {
    const res = await db.query(`
        SELECT
            btrim(c2.c2_num) as op,
            btrim(c2.c2_item) as item,
            btrim(c2.c2_pedido) as pedido,
            btrim(c2.c2_produto) as produto,
            c2.c2_quant as qtd_plan,
            c2.c2_datpri as data_ini_plan,
            pg_typeof(c2.c2_datpri) as tipo_campo
        FROM sc2010 c2
        WHERE TRIM(c2.c2_pedido) = '004156'
          AND COALESCE(c2.d_e_l_e_t_, '') = ''
        LIMIT 20
    `);

    if (res.rows.length === 0) {
        console.log('Nenhuma OP encontrada para pedido 004156');
    } else {
        res.rows.forEach(r => {
            const raw = r.data_ini_plan;
            const s = String(raw ?? '');
            console.log(`OP: ${r.op}-${r.item} | Produto: ${r.produto} | c2_datpri raw: [${raw}] | tipo: ${r.tipo_campo} | str: "${s}" | len: ${s.length}`);
        });
    }

    await db.end();
}

main().catch(console.error);
