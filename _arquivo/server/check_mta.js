require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
});

async function run() {
    try {
        const result = await pool.query(`
            SELECT 
                TRIM(sc2.C2_NUM) as op,
                TRIM(sc2.C2_ITEM) as item,
                TRIM(sc2.C2_SEQUEN) as sequen,
                TRIM(sc2.C2_PRODUTO) as produto_pai,
                TRIM(sg1.G1_COMP) as componente,
                sg1.G1_QUANT as qtd_na_estrutura
            FROM public.sg1010 sg1
            INNER JOIN public.sc2010 sc2 ON TRIM(sc2.C2_PRODUTO) = TRIM(sg1.G1_COD)
            WHERE TRIM(sg1.G1_COMP) LIKE '%MTA-1496%'
              AND TRIM(sc2.D_E_L_E_T_) = ''
              AND TRIM(sg1.D_E_L_E_T_) = ''
              AND TRIM(sc2.C2_DATRF) = '' -- OP em aberto
        `);
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (e) {
        console.error('Erro:', e.message);
    } finally {
        await pool.end();
    }
}
run();
