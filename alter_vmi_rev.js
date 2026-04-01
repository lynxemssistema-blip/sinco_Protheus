const { mysqlPool } = require('./server/services/mysqlService');

async function run() {
    try {
        await mysqlPool.execute('ALTER TABLE app_demanda_vmi ADD COLUMN rev_cliente VARCHAR(50) DEFAULT NULL AFTER descricao_produto_cliente;');
        console.log("Column rev_cliente added successfully.");
        process.exit(0);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column rev_cliente already exists.");
            process.exit(0);
        } else {
            console.error(e);
            process.exit(1);
        }
    }
}
run();
