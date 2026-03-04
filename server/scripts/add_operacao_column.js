require('dotenv').config();
const mysqlPool = require('../services/mysqlService');

async function migrate() {
    try {
        console.log('🔌 Conectando ao MySQL...');

        // Verificar se a coluna já existe
        const [columns] = await mysqlPool.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'produtos_docs' AND COLUMN_NAME = 'operacao'`,
            [process.env.MYSQL_DB || 'u850383788_fisa_anty']
        );

        if (columns.length > 0) {
            console.log('⚠️ Coluna "operacao" já existe. Nada a fazer.');
        } else {
            console.log('🔄 Adicionando coluna "operacao"...');
            await mysqlPool.execute('ALTER TABLE produtos_docs ADD COLUMN operacao VARCHAR(255) DEFAULT NULL');
            console.log('✅ Coluna "operacao" adicionada com sucesso!');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Erro na migração:', err);
        process.exit(1);
    }
}

migrate();
