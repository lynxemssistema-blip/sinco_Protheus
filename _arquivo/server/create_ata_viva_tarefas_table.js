require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
    });

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_ata_viva_tarefas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item_pedido VARCHAR(10) NOT NULL,
                op_numero VARCHAR(20),
                produto VARCHAR(50),
                texto_tarefa TEXT NOT NULL,
                status ENUM('PENDENTE', 'CONCLUIDO') DEFAULT 'PENDENTE',
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_conclusao DATETIME NULL,
                usuario_criacao VARCHAR(100),
                usuario_conclusao VARCHAR(100),
                INDEX idx_pedido_item (pedido, item_pedido),
                INDEX idx_status (status)
            );
        `);
        console.log('Tabela app_ata_viva_tarefas verificada/criada com sucesso.');
    } catch (err) {
        console.error('Erro ao criar tabela:', err);
    } finally {
        pool.end();
    }
}
run();
