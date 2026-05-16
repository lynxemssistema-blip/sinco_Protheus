const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const db = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        // 1. Create pcp_manutencao_tecnicos
        await db.query(`
            CREATE TABLE IF NOT EXISTS pcp_manutencao_tecnicos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT NOT NULL,
                especialidade VARCHAR(255) DEFAULT 'GERAL',
                ativo BOOLEAN DEFAULT TRUE,
                UNIQUE KEY (id_usuario)
            )
        `);
        console.log("Tabela pcp_manutencao_tecnicos criada.");

        // 2. Add resolvido and fotos_execucao to ordens
        try { await db.query('ALTER TABLE pcp_manutencao_ordens ADD COLUMN resolvido BOOLEAN DEFAULT NULL'); } catch(e){}
        try { await db.query('ALTER TABLE pcp_manutencao_ordens ADD COLUMN fotos_execucao LONGTEXT'); } catch(e){}
        
        console.log("Colunas resolvido e fotos_execucao adicionadas.");

    } catch (e) {
        console.error(e.message);
    } finally {
        await db.end();
    }
}
run();
