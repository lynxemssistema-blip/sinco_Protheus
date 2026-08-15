require('dotenv').config({ path: './server/.env' });
const mysql = require('../services/mysqlService');

async function run() {
    try {
        // Descobre qual tabela tem C2_PEDIDO
        const [tabs] = await mysql.query("SHOW TABLES");
        const allTabs = tabs.map(t => Object.values(t)[0]);
        const sc2like = allTabs.filter(t => t.includes('sg2') || t.includes('sc2') || t.includes('c2'));
        console.log('Tabelas relacionadas a OPs:', sc2like);

        // Tenta sg2010 diretamente
        const [ops] = await mysql.query(
            "SELECT DISTINCT TRIM(C2_NUM) as op_num FROM sg2010 WHERE TRIM(C2_PEDIDO) = '004618' AND D_E_L_E_T_ = ' ' ORDER BY C2_NUM LIMIT 50"
        );
        console.log('OPs pedido 004618:', JSON.stringify(ops.map(r => r.op_num)));
        process.exit(0);
    } catch(e) {
        console.error('ERRO:', e.message);
        // Tenta via app_production_planning
        try {
            const mysql2 = require('../services/mysqlService');
            const [rows] = await mysql2.query(
                "SELECT DISTINCT op_numero FROM app_production_planning ORDER BY op_numero LIMIT 20"
            );
            console.log('OPs já planejadas:', JSON.stringify(rows.map(r=>r.op_numero)));
        } catch(e2) { console.error('e2:', e2.message); }
        process.exit(1);
    }
}
run();
