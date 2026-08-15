require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.PGUSER, host: process.env.PGHOST, database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD, port: process.env.PGPORT,
});
async function main() {
    try {
        const cols = await pool.query(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name='sz1010' ORDER BY ordinal_position`);
        console.log(cols.rows);

        const sample = await pool.query(`
            SELECT z1_produto, z1_codcli, z1_revisao, d_e_l_e_t_
            FROM public.sz1010
            WHERE TRIM(z1_produto) = 'MT3-10523'
            ORDER BY z1_revisao DESC
        `);
        console.log('Amostra MT3-10523:', sample.rows);

        const lens = await pool.query(`
            SELECT LENGTH(TRIM(z1_revisao)) as len, COUNT(*) FROM public.sz1010
            WHERE COALESCE(d_e_l_e_t_,'')='' GROUP BY 1 ORDER BY 2 DESC LIMIT 10
        `);
        console.log('Distribuicao tamanho z1_revisao:', lens.rows);
    } catch (e) { console.error(e); } finally { await pool.end(); }
}
main();
