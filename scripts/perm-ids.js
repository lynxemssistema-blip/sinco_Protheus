require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const m = require('mysql2/promise');
(async () => {
    const c = await m.createConnection({ host: process.env.MYSQL_HOST, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASS, database: 'u494795077_SINCO' });
    const [p] = await c.query('SELECT page_id, COUNT(*) n, SUM(can_view) v, SUM(can_edit) e FROM app_user_permissions GROUP BY page_id ORDER BY page_id');
    console.log(JSON.stringify(p));
    const [u] = await c.query('SELECT TipoUsuario t, COUNT(*) n FROM usuario GROUP BY TipoUsuario');
    console.log(JSON.stringify(u));
    await c.end();
})().catch(e => console.log('ERRO', e.message));
