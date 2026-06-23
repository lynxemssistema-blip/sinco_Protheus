const pool = require('../services/mysqlService');

async function run() {
    try {
        console.log('Verificando/adicionando coluna grupo_id na tabela app_calendario_atividades...');
        
        const [columns] = await pool.query(`
            SHOW COLUMNS FROM app_calendario_atividades LIKE 'grupo_id'
        `);

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE app_calendario_atividades 
                ADD COLUMN grupo_id VARCHAR(36) DEFAULT NULL,
                ADD INDEX idx_grupo_id (grupo_id)
            `);
            console.log('Coluna grupo_id adicionada com sucesso.');
        } else {
            console.log('Coluna grupo_id já existe na tabela.');
        }
    } catch (err) {
        console.error('Erro ao adicionar coluna:', err);
    } finally {
        process.exit(0);
    }
}
run();
