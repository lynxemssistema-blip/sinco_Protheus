const db = require('./server/services/mysqlService');

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS sgq_fornecedores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                telefone VARCHAR(50),
                contato VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('sgq_fornecedores created');
        
        try {
            await db.query("ALTER TABLE sgq_romaneios ADD COLUMN fornecedor_id INT");
            await db.query("ALTER TABLE sgq_romaneios ADD COLUMN fornecedor_email VARCHAR(255)");
        } catch(e) { console.log('Columns in sgq_romaneios might already exist:', e.message); }
        
    } catch(e) {
        console.log('Error:', e.message);
    }
    process.exit();
}

run();
