const mysql = require('mysql2/promise');
const { Client } = require('pg');

async function check() {
    const mysqlPool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'metalfisa_pcp' });
    const pgClient = new Client({ user: 'postgres', host: 'localhost', database: 'metalfisa_pcp', password: '123', port: 5432 });
    await pgClient.connect();

    // Check MySQL Planning for LASER
    const [mysqlRes] = await mysqlPool.query("SELECT op_numero, recurso_codigo, data_planejada_inicio FROM app_production_planning WHERE recurso_codigo LIKE '%LASER%' ORDER BY data_planejada_inicio DESC LIMIT 5");
    console.log('MySQL Planning (Laser):', mysqlRes);

    // Check all planning to see if there is any date in June 2026
    const [mysqlResJune] = await mysqlPool.query("SELECT op_numero, recurso_codigo, data_planejada_inicio FROM app_production_planning WHERE data_planejada_inicio <= '2026-06-15 23:59:59' ORDER BY data_planejada_inicio DESC LIMIT 5");
    console.log('MySQL Planning (<= 2026-06-15):', mysqlResJune);

    // Also check Protheus structure for LASER
    const pgRes = await pgClient.query("SELECT h1_codigo, h1_descri FROM sh1010 WHERE h1_descri ILIKE '%LASER%'");
    console.log('Protheus Recurso (Laser):', pgRes.rows);

    await pgClient.end();
    process.exit(0);
}
check();
