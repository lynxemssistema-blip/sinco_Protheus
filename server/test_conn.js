const db = require('./db');

async function testConnection() {
    console.log('Iniciando teste de conexão...');
    try {
        const res = await db.query('SELECT NOW() as current_time');
        console.log('✅ Conexão BEM SUCEDIDA!');
        console.log('Hora do servidor banco:', res.rows[0].current_time);
        process.exit(0);
    } catch (err) {
        console.error('❌ FALHA na conexão:');
        console.error(err.message);
        process.exit(1);
    }
}

testConnection();
