const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        console.log("Adding column...");
        await mysqlPool.query(`
            ALTER TABLE app_demanda_vmi 
            ADD COLUMN descricao_equipamento VARCHAR(255) AFTER codigo_produto_cliente
        `);
        console.log("Column descricao_equipamento added successfully.");
        process.exit(0);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists.");
            process.exit(0);
        }
        console.error(e);
        process.exit(1);
    }
}
run();
