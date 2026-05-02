const db = require('./services/protheusDB');
async function run() {
    try {
        const res = await db.query("SELECT DISTINCT c2_tpop FROM public.sc2010");
        console.table(res.rows);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
