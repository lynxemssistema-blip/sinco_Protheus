const db = require('../services/mysqlService');

async function createTables() {
    console.log('Criando tabela app_protheus_query_catalog...');
    await db.execute(`
        CREATE TABLE IF NOT EXISTS app_protheus_query_catalog (
            id INT AUTO_INCREMENT PRIMARY KEY,
            file_source VARCHAR(255) NOT NULL,
            sql_content TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('Tabela app_protheus_query_catalog criada.');

    console.log('Criando tabela app_protheus_study_chat...');
    await db.execute(`
        CREATE TABLE IF NOT EXISTS app_protheus_study_chat (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            role VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('Tabela app_protheus_study_chat criada.');
    
    // Clear catalog table for re-population just in case
    await db.execute(`TRUNCATE TABLE app_protheus_query_catalog;`);
    console.log('Catálogo resetado para repopulação limpa.');

    console.log('Finalizado com sucesso.');
    process.exit(0);
}

createTables().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
});
