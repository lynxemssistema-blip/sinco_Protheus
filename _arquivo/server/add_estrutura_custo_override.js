require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_estrutura_custo_override (
                id INT AUTO_INCREMENT PRIMARY KEY,
                produto_pai VARCHAR(30) NOT NULL,
                produto_componente VARCHAR(30) NOT NULL,
                preco_unitario DECIMAL(18,4) NOT NULL DEFAULT 0,
                atualizado_por VARCHAR(120),
                atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY idx_pai_componente (produto_pai, produto_componente)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('Tabela app_estrutura_custo_override criada/verificada com sucesso');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
