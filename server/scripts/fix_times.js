const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function run() {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
        });

        const [res1] = await pool.query("UPDATE pcp_programas_execucoes SET tempo_realizado_segundos = TIMESTAMPDIFF(SECOND, hora_inicio, hora_fim) WHERE status = 'CONCLUIDA' AND hora_fim IS NOT NULL");
        console.log('Execucoes corrigidas:', res1.affectedRows);

        const [res2] = await pool.query("UPDATE pcp_programas_paradas SET tempo_segundos = TIMESTAMPDIFF(SECOND, data_inicio, data_fim) WHERE status = 'CONCLUIDA' AND data_fim IS NOT NULL");
        console.log('Paradas corrigidas:', res2.affectedRows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
