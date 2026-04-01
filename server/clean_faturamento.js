require('dotenv').config();
const mysql = require('mysql2/promise');

async function clean() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
    });

    try {
        console.log('Executing DELETE FROM app_faturamento_solicitacao_itens...');
        await pool.execute('DELETE FROM app_faturamento_solicitacao_itens;');
        console.log('Executing DELETE FROM app_faturamento_solicitacoes...');
        await pool.execute('DELETE FROM app_faturamento_solicitacoes;');
        console.log('All Faturamento testing tables cleared successfully!');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}
clean();
