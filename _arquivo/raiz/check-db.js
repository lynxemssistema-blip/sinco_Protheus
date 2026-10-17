const db = require('./server/services/mysqlService');

async function run() {
    try {
        const [rows] = await db.query('SELECT * FROM app_sgq_processos WHERE route_path = ?', ['/pcp/fila-dependencias']);
        console.log(rows);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
