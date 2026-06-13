const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const pg = require('../server/db');

async function main() {
    try {
        const pgSz1 = await pg.query(
            `SELECT z1_codcli, z1_produto, z1_revisao, d_e_l_e_t_
             FROM public.sz1010
             WHERE TRIM(z1_produto) = $1 OR TRIM(z1_codcli) = $2`,
            ['MT6-6240', '33.03.10235.01']
        );
        console.log('PostgreSQL SZ1010 rows with d_e_l_e_t_:', pgSz1.rows);

        const pgSb1 = await pg.query(
            `SELECT b1_cod, b1_desc, b1_msblql, d_e_l_e_t_
             FROM public.sb1010 
             WHERE TRIM(b1_cod) = $1`,
            ['MT6-6240']
        );
        console.log('PostgreSQL SB1010 rows with d_e_l_e_t_:', pgSb1.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
main();
