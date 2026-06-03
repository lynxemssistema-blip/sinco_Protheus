require('dotenv').config();
const mysql = require('mysql2/promise');

async function createTables() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS nfe_auditorias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido_compra VARCHAR(20) NOT NULL,
                numero_nf VARCHAR(20) NOT NULL,
                chave_acesso VARCHAR(44) NOT NULL,
                fornecedor_nome VARCHAR(255),
                fornecedor_cnpj VARCHAR(20),
                status ENUM('Conforme', 'Com Divergências') NOT NULL,
                usuario VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS nfe_auditoria_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_auditoria INT NOT NULL,
                item_xml VARCHAR(10) NOT NULL,
                cprod_xml VARCHAR(50),
                qtd_xml DECIMAL(15,2),
                vlr_xml DECIMAL(15,2),
                cprod_protheus VARCHAR(50),
                qtd_protheus DECIMAL(15,2),
                vlr_protheus DECIMAL(15,2),
                status ENUM('✅ Conforme', '❌ Divergência de Quantidade', '❌ Divergência de Valor', '❌ Produto não mapeado') NOT NULL,
                detalhe_divergencia TEXT,
                FOREIGN KEY (id_auditoria) REFERENCES nfe_auditorias(id) ON DELETE CASCADE
            );
        `);

        console.log("Tabelas de auditoria criadas com sucesso!");
    } catch (e) {
        console.error("Erro ao criar tabelas:", e);
    } finally {
        pool.end();
    }
}

createTables();
