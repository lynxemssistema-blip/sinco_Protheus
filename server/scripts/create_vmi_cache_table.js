const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    
    await conn.query(`
        CREATE TABLE IF NOT EXISTS app_demanda_vmi_pedidos_cache (
            ordem_compra_cliente VARCHAR(100) NOT NULL, 
            codigo_produto_cliente VARCHAR(100) NOT NULL, 
            pedido_metalfisa VARCHAR(255), 
            data_criacao_metalfisa VARCHAR(255), 
            data_entrega_metalfisa VARCHAR(255), 
            qtd_pedido DECIMAL(10,2), 
            qtd_entregue DECIMAL(10,2), 
            saldo_entregar DECIMAL(10,2), 
            notas_fiscais TEXT, 
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
            PRIMARY KEY (ordem_compra_cliente, codigo_produto_cliente)
        ) COLLATE='utf8mb4_unicode_ci' ENGINE=InnoDB;
    `);
    
    console.log('Table created!');
    conn.end();
}
run();
