const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
    try {
        const conn = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB,
            connectTimeout: 8000
        });
        const [rows] = await conn.query("SHOW TABLES LIKE 'nfe_%'");
        console.log('Tabelas NFE encontradas:', rows.length);
        rows.forEach(r => console.log(' -', Object.values(r)[0]));
        if (rows.length === 0) {
            console.log('\nCriando tabelas...');
            await conn.query(`CREATE TABLE IF NOT EXISTS nfe_auditorias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido_compra VARCHAR(20),
                numero_nf VARCHAR(20),
                chave_acesso VARCHAR(60),
                fornecedor_nome VARCHAR(200),
                fornecedor_cnpj VARCHAR(20),
                status VARCHAR(50),
                usuario VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
            await conn.query(`CREATE TABLE IF NOT EXISTS nfe_auditoria_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_auditoria INT NOT NULL,
                item_xml VARCHAR(10),
                cprod_xml VARCHAR(60),
                qtd_xml DECIMAL(15,4),
                vlr_xml DECIMAL(15,4),
                cprod_protheus VARCHAR(60),
                qtd_protheus DECIMAL(15,4),
                vlr_protheus DECIMAL(15,4),
                status VARCHAR(100),
                detalhe_divergencia TEXT,
                FOREIGN KEY (id_auditoria) REFERENCES nfe_auditorias(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
            console.log('Tabelas criadas com sucesso!');
        }
        await conn.end();
    } catch(e) {
        console.error('ERRO:', e.message);
    }
})();
