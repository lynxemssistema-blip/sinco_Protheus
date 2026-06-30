const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrate() {
    console.log("Iniciando migração do esquema de pcp_programas para terceirização...");
    let mysqlPool;
    try {
        mysqlPool = mysql.createPool({
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASS || '',
            database: process.env.MYSQL_DB || 'metalfisa',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Verificando e adicionando 'tipo_execucao'
        console.log("Verificando se tipo_execucao existe...");
        const [colsTipo] = await mysqlPool.query("SHOW COLUMNS FROM pcp_programas_liberados LIKE 'tipo_execucao'");
        if (colsTipo.length === 0) {
            await mysqlPool.query("ALTER TABLE pcp_programas_liberados ADD COLUMN tipo_execucao ENUM('INTERNA', 'TERCEIRIZADA') DEFAULT 'INTERNA' AFTER status");
            console.log("✅ Coluna 'tipo_execucao' adicionada.");
        } else {
            console.log("ℹ️ Coluna 'tipo_execucao' já existe.");
        }

        // Verificando e adicionando 'terceirizado_empresa'
        const [colsEmpresa] = await mysqlPool.query("SHOW COLUMNS FROM pcp_programas_liberados LIKE 'terceirizado_empresa'");
        if (colsEmpresa.length === 0) {
            await mysqlPool.query("ALTER TABLE pcp_programas_liberados ADD COLUMN terceirizado_empresa VARCHAR(255) NULL AFTER tipo_execucao");
            console.log("✅ Coluna 'terceirizado_empresa' adicionada.");
        }

        // Verificando e adicionando 'terceirizado_escopo'
        const [colsEscopo] = await mysqlPool.query("SHOW COLUMNS FROM pcp_programas_liberados LIKE 'terceirizado_escopo'");
        if (colsEscopo.length === 0) {
            await mysqlPool.query("ALTER TABLE pcp_programas_liberados ADD COLUMN terceirizado_escopo TEXT NULL AFTER terceirizado_empresa");
            console.log("✅ Coluna 'terceirizado_escopo' adicionada.");
        }

        // Verificando e adicionando 'terceirizado_data_envio'
        const [colsEnvio] = await mysqlPool.query("SHOW COLUMNS FROM pcp_programas_liberados LIKE 'terceirizado_data_envio'");
        if (colsEnvio.length === 0) {
            await mysqlPool.query("ALTER TABLE pcp_programas_liberados ADD COLUMN terceirizado_data_envio DATE NULL AFTER terceirizado_escopo");
            console.log("✅ Coluna 'terceirizado_data_envio' adicionada.");
        }

        // Verificando e adicionando 'terceirizado_data_retorno'
        const [colsRetorno] = await mysqlPool.query("SHOW COLUMNS FROM pcp_programas_liberados LIKE 'terceirizado_data_retorno'");
        if (colsRetorno.length === 0) {
            await mysqlPool.query("ALTER TABLE pcp_programas_liberados ADD COLUMN terceirizado_data_retorno DATE NULL AFTER terceirizado_data_envio");
            console.log("✅ Coluna 'terceirizado_data_retorno' adicionada.");
        }

        console.log("✅ Migração do esquema pcp_programas (Terceirização) concluída com sucesso!");

    } catch (error) {
        console.error("❌ Erro durante a migração:", error);
    } finally {
        if (mysqlPool) await mysqlPool.end();
    }
}

migrate();
