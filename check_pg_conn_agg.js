require('dotenv').config({ path: './server/.env' });
const db = require('./server/db');

async function checkConnections() {
    try {
        const stats = await db.query(`
            SELECT state, count(*) as total
            FROM pg_stat_activity 
            WHERE datname = current_database()
            GROUP BY state
        `);
        console.log("=== RESUMO POR ESTADO ===");
        console.table(stats.rows);

        const clients = await db.query(`
            SELECT client_addr, count(*) as total
            FROM pg_stat_activity 
            WHERE datname = current_database()
            GROUP BY client_addr
        `);
        console.log("=== RESUMO POR IP ===");
        console.table(clients.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
checkConnections();
