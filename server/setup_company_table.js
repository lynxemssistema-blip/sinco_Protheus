require('dotenv').config();
const mysqlPool = require('./services/mysqlService');

async function setupCompanyTable() {
    try {
        console.log('🔧 Creating app_company_settings table...');

        await mysqlPool.execute(`
            CREATE TABLE IF NOT EXISTS app_company_settings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                cnpj VARCHAR(20),
                razao_social VARCHAR(255),
                endereco VARCHAR(255),
                bairro VARCHAR(100),
                cidade VARCHAR(100),
                uf VARCHAR(2),
                cep VARCHAR(10),
                telefone VARCHAR(20),
                menu_config TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Table created/verified successfully!');

        // Insert default row if table is empty
        const [rows] = await mysqlPool.query('SELECT COUNT(*) as count FROM app_company_settings');

        if (rows[0].count === 0) {
            console.log('📝 Inserting default company settings...');
            await mysqlPool.execute(`
                INSERT INTO app_company_settings (id, razao_social) 
                VALUES (1, 'MetalFisa')
            `);
            console.log('✅ Default settings inserted!');
        } else {
            console.log('ℹ️  Company settings already exist.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

setupCompanyTable();
