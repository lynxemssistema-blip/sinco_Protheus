const db = require('./db'); console.log('Testing matrix items...'); const mysqlPool = require('./services/mysqlService');

(async () => {
    try {
        const [rows] = await mysqlPool.query("SELECT id, op_numero, op_item, op_sequencia, operacao_codigo, quantidade FROM app_production_appointments WHERE op_numero = '006185'");
        console.table(rows);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
