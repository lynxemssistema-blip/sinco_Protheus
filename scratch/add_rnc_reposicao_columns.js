const db = require('c:\\Users\\adm\\Desktop\\MetalFisa Anty\\server\\services\\mysqlService');

async function run() {
    try {
        console.log('Altering app_sgq_rncs table to add reposicao fields...');
        
        // We will try to add each column, wrapping in try/catch in case they already exist.
        try {
            await db.query('ALTER TABLE app_sgq_rncs ADD COLUMN reposicao_solicitada TINYINT(1) DEFAULT 0');
            console.log('Added reposicao_solicitada column.');
        } catch (e) {
            console.log('reposicao_solicitada column may already exist or error:', e.message);
        }

        try {
            await db.query('ALTER TABLE app_sgq_rncs ADD COLUMN reposicao_liberada TINYINT(1) DEFAULT 0');
            console.log('Added reposicao_liberada column.');
        } catch (e) {
            console.log('reposicao_liberada column may already exist or error:', e.message);
        }

        try {
            await db.query('ALTER TABLE app_sgq_rncs ADD COLUMN reposicao_data_solicitacao DATETIME DEFAULT NULL');
            console.log('Added reposicao_data_solicitacao column.');
        } catch (e) {
            console.log('reposicao_data_solicitacao column may already exist or error:', e.message);
        }

        try {
            await db.query('ALTER TABLE app_sgq_rncs ADD COLUMN reposicao_data_liberacao DATETIME DEFAULT NULL');
            console.log('Added reposicao_data_liberacao column.');
        } catch (e) {
            console.log('reposicao_data_liberacao column may already exist or error:', e.message);
        }

        try {
            await db.query('ALTER TABLE app_sgq_rncs ADD COLUMN reposicao_usuario_liberou VARCHAR(100) DEFAULT NULL');
            console.log('Added reposicao_usuario_liberou column.');
        } catch (e) {
            console.log('reposicao_usuario_liberou column may already exist or error:', e.message);
        }

        try {
            await db.query('ALTER TABLE app_sgq_rncs ADD COLUMN reposicao_op VARCHAR(20) DEFAULT NULL');
            console.log('Added reposicao_op column.');
        } catch (e) {
            console.log('reposicao_op column may already exist or error:', e.message);
        }

        console.log('Database migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error during migration:', err);
        process.exit(1);
    }
}

run();
