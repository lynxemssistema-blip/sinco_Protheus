require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function main() {
    try {
        const total = await pool.query("SELECT COUNT(*) FROM public.sb1010 WHERE COALESCE(d_e_l_e_t_,'')<>'*'");
        console.log('Total ativos:', total.rows[0].count);

        const lenDist = await pool.query(`
            SELECT LENGTH(TRIM(b1_posipi)) as len, COUNT(*)
            FROM public.sb1010
            WHERE COALESCE(d_e_l_e_t_,'')<>'*'
            GROUP BY 1 ORDER BY 2 DESC LIMIT 20
        `);
        console.log('Distribuicao tamanho b1_posipi:', lenDist.rows);

        const nonDigit = await pool.query(`
            SELECT COUNT(*) FROM public.sb1010
            WHERE COALESCE(d_e_l_e_t_,'')<>'*'
            AND TRIM(b1_posipi) !~ '^[0-9]{8}$'
        `);
        console.log('Nao bate padrao 8 digitos:', nonDigit.rows[0].count);

        const sample = await pool.query(`
            SELECT b1_cod, b1_desc, b1_posipi, b1_xrevm FROM public.sb1010
            WHERE COALESCE(d_e_l_e_t_,'')<>'*'
            AND TRIM(b1_posipi) !~ '^[0-9]{8}$'
            LIMIT 15
        `);
        console.log('Amostra invalidos:', sample.rows);

        const revBlank = await pool.query(`
            SELECT COUNT(*) FROM public.sb1010
            WHERE COALESCE(d_e_l_e_t_,'')<>'*'
            AND TRIM(COALESCE(b1_xrevm,'')) = ''
        `);
        console.log('RevMetalfisa vazio:', revBlank.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
