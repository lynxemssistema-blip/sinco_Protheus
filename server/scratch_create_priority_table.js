require('dotenv').config();
const mysql = require('mysql2/promise');

async function createTable() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    
    try {
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS app_op_priorities (
                op_numero VARCHAR(50) PRIMARY KEY,
                prioridade INT NOT NULL DEFAULT 0,
                atualizado_por VARCHAR(100),
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log("✅ Tabela app_op_priorities criada com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao criar tabela:", err);
    } finally {
        conn.end();
    }
}
createTable();
