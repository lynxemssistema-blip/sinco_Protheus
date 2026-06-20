const db = require('./services/mysqlService');
db.execute(`
    CREATE TABLE IF NOT EXISTS app_engineering_product_releases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        produto_codigo VARCHAR(100) NOT NULL,
        revisao VARCHAR(50) DEFAULT '',
        liberado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        liberado_por_id INT,
        liberado_por_nome VARCHAR(255),
        UNIQUE KEY uk_prod_rev (produto_codigo, revisao)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`).then(() => {
    console.log('Table created.');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
