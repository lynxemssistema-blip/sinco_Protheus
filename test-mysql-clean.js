require('dotenv').config({ path: './server/.env' });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function run() {
  try {
    const [appointments] = await pool.query(`
            SELECT 
                op_numero, op_item, op_sequencia, operacao_codigo,
                SUM(quantidade) as total_produzido,
                COUNT(*) as num_apontamentos,
                SUM(CASE WHEN conferencia_status = 'PENDENTE' THEN 1 ELSE 0 END) as pendencias_conferencia,
                MIN(data_inicio) as data_real_inicio,
                MAX(data_fim) as data_real_fim,
                MAX(data_fim) as ultimo_apontamento
            FROM app_production_appointments
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
            LIMIT 1
        `);
    console.log('OK');
  } catch (e) {
    console.error('ERROR MESSAGE:', e.message);
  } finally {
    pool.end();
  }
}

run();
