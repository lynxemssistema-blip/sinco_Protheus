const mysqlPool = require('c:/Users/adm/Desktop/MetalFisa Anty/server/services/mysqlService');

async function run() {
    try {
        console.log("=== REMAINING APPOINTMENTS FOR ORDER 004089 / OPs ===");

        const opList = ['006169', '004089'];
        const placeholders = opList.map(() => '?').join(',');

        const queryApp = `
            SELECT id, op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, conferencia_status
            FROM app_production_appointments
            WHERE op_numero IN (${placeholders})
        `;
        const [rowsApp] = await mysqlPool.query(queryApp, opList);
        console.log(`Total appointments remaining: ${rowsApp.length}`);
        
        rowsApp.forEach(r => {
            console.log(`ID: ${r.id} | OP: ${r.op_numero} | Item: ${r.op_item} | Seq: ${r.op_sequencia} | OpCode: ${r.operacao_codigo} | Qty: ${r.quantidade} | User: ${r.usuario} | Status: ${r.conferencia_status}`);
        });

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

run();
