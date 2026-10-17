const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, 'server', '.env') });
async function run() {
    const pool = mysql.createPool({ host: '192.168.1.77', user: 'sinco', password: process.env.SINCO_MYSQL_PASSWORD || 'Pro1042@sm', database: 'metalfisa' });
    try {
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.query('TRUNCATE TABLE app_faturamento_solicitacao_itens');
        await pool.query('TRUNCATE TABLE app_faturamento_solicitacoes');
        await pool.query('TRUNCATE TABLE app_faturamento_auditoria');
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Tabelas limpas com sucesso!');
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
