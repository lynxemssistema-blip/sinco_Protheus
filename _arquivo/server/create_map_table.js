const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        console.log("Creating map table...");
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_demanda_vmi_map (
                id INT AUTO_INCREMENT PRIMARY KEY,
                codigo_produto_cliente VARCHAR(100) NOT NULL,
                b1_cod VARCHAR(50) NOT NULL,
                descricao_protheus VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_cod_cli (codigo_produto_cliente)
            )
        `);
        console.log("Table app_demanda_vmi_map created successfully.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
