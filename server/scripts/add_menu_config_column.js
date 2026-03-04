const pool = require('../services/mysqlService');

async function migrate() {
    console.log('🔄 Iniciando migração para adicionar coluna MENU_CONFIG...');
    try {
        // Check if column exists
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'app_company_settings' 
            AND COLUMN_NAME = 'menu_config'
        `);

        if (columns.length > 0) {
            console.log('⚠️ Coluna menu_config já existe. Pulando.');
            process.exit(0);
        }

        // Add column
        await pool.query(`
            ALTER TABLE app_company_settings
            ADD COLUMN menu_config TEXT DEFAULT NULL COMMENT 'JSON storage for menu visibility settings';
        `);

        console.log('✅ Coluna menu_config adicionada com sucesso!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Erro na migração:', err);
        process.exit(1);
    }
}

migrate();
