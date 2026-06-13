const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const pg = require('../server/db');

async function main() {
    try {
        const res = await pg.query(
            `SELECT z1_codcli, z1_produto, z1_revisao, d_e_l_e_t_
             FROM public.sz1010
             WHERE TRIM(z1_produto) IN ($1, $2)`,
            ['MT6-6240', 'MT3-11707']
        );
        console.log('PostgreSQL SZ1010 mapping for both:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
main();
