const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../services/mysqlService');

async function migrate() {
    try {
        console.log('Verificando coluna cadastro_novo...');
        const [cols] = await db.query("SHOW COLUMNS FROM app_wabtec_estruturas LIKE 'cadastro_novo'");
        if (cols.length === 0) {
            await db.query("ALTER TABLE app_wabtec_estruturas ADD COLUMN cadastro_novo TINYINT(1) DEFAULT 0 AFTER protheus_rev");
            console.log("✅ Coluna cadastro_novo adicionada com sucesso!");
        } else {
            console.log("ℹ️ Coluna cadastro_novo já existe.");
        }

        const [res] = await db.query(
            "UPDATE app_wabtec_estruturas SET cadastro_novo = 1 WHERE desenho_cliente = ? OR protheus_cod = ?",
            ['84D703600BSG1', 'MT2-3333']
        );
        console.log("✅ Linhas atualizadas como novo:", res.affectedRows);
        process.exit(0);
    } catch (e) {
        console.error("❌ Erro na migração:", e);
        process.exit(1);
    }
}

migrate();
