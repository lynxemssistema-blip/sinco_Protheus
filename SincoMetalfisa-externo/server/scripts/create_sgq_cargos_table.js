// server/scripts/create_sgq_cargos_table.js
const db = require('../db');

async function createTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS sgq_cargos_funcoes (
                id SERIAL PRIMARY KEY,
                denominacao VARCHAR(255) NOT NULL,
                codigo_interno VARCHAR(50),
                cbo VARCHAR(50),
                atividades JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Table sgq_cargos_funcoes created successfully");
    } catch (e) {
        console.error("Error creating table: ", e);
    } finally {
        process.exit(0);
    }
}

createTable();
