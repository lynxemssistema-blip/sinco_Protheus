const db = require('./db');

async function test() {
    let client = null;
    try {
        client = await db.connect();
        const res = await client.query(`
            SELECT table_name, privilege_type 
            FROM information_schema.role_table_grants 
            WHERE grantee = 'sinco2' AND privilege_type = 'UPDATE'
        `);
        console.log('Tables sinco2 can UPDATE:', res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        if (client) client.release();
        process.exit();
    }
}
test();
