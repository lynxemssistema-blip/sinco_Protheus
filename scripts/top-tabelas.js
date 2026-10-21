require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const m = require('mysql2/promise');
(async () => {
    const c = await m.createConnection({ host: process.env.MYSQL_HOST, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASS, database: 'u494795077_SINCO' });
    const [[r]] = await c.query('SELECT DATABASE() d'); console.log('DB:', r.d);
    const [t] = await c.query("SELECT TABLE_NAME t,TABLE_ROWS r,ROUND((DATA_LENGTH+INDEX_LENGTH)/1048576,2) mb FROM information_schema.TABLES WHERE TABLE_SCHEMA='u494795077_SINCO' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_ROWS DESC LIMIT 30");
    console.table(t);
    const [[n]] = await c.query("SELECT COUNT(*) n, SUM(TABLE_ROWS>0) com FROM information_schema.TABLES WHERE TABLE_SCHEMA='u494795077_SINCO' AND TABLE_TYPE='BASE TABLE'");
    console.log(n);
    await c.end();
})().catch(e => console.log('ERRO', e.message));
