require('dotenv').config({path: './server/.env'});
const mysqlPool = require('./server/services/mysqlService');

async function test() {
    try {
        const [appointments] = await mysqlPool.query(
            `SELECT op_numero, op_item, op_sequencia, operacao_codigo, quantidade
             FROM app_production_appointments
             WHERE op_numero = '003595'`
        );
        console.log("Appts for 003595:");
        console.log(appointments.filter(a => Number(a.op_sequencia) === 16 || a.op_sequencia.includes('16')));
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
