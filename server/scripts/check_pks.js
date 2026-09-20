const mysql = require('mysql2/promise');

async function checkPks() {
    const conn = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_Metalfisa',
        password: '10207597Rdv*',
        database: 'u494795077_Metalfisa',
        dateStrings: true
    });

    const largeTables = [
        'app_pcp_historico_revisao',
        'app_production_planning',
        'app_production_appointments',
        'app_production_planning_diario',
        'produtos_docs',
        'app_planning_history',
        'app_pcp_delivery_forecasts',
        'app_wabtec_imported_rows',
        'material'
    ];

    for (const t of largeTables) {
        const [keys] = await conn.query(`SHOW KEYS FROM \`${t}\` WHERE Key_name = 'PRIMARY'`);
        const pk = keys.map(k => k.Column_name).join(', ');
        console.log(`${t.padEnd(35)}: PK = ${pk || 'NONE'}`);
    }

    await conn.end();
}

checkPks().catch(console.error);
