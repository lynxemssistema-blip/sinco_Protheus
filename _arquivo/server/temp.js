const pool = require('./services/mysqlService');

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_ata_viva_tarefas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(50),
                item_pedido VARCHAR(20),
                op_numero VARCHAR(50),
                produto VARCHAR(50),
                texto_tarefa TEXT,
                usuario_criacao VARCHAR(100),
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("app_ata_viva_tarefas created");
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_hermes_acknowledgments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message_id VARCHAR(100),
                message_text TEXT,
                user_id INT,
                user_name VARCHAR(100),
                read_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("app_hermes_acknowledgments created");
    } catch(err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
