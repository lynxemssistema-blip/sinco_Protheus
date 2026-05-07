const pg = require('./db');

async function run() {
    try {
        const query = "SELECT c6_produto, c6_item FROM public.sc6010 WHERE c6_num='003954' AND COALESCE(d_e_l_e_t_,'')=''";
        const res = await pg.query(query);
        console.log(res.rows);
    } catch(err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
