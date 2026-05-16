require('dotenv').config({ path: './server/.env' });
const db = require('./server/db');

async function checkConnections() {
    try {
        const result = await db.query(`
            SELECT pid, usename, client_addr, state, query 
            FROM pg_stat_activity 
            WHERE datname = current_database()
            ORDER BY state DESC
        `);
        console.table(result.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
checkConnections();
