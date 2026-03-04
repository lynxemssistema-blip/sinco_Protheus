// Test Database Connections
const path = require('path');

// Set env path
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const db = require('./server/db'); // PostgreSQL
const mysqlPool = require('./server/services/mysqlService'); // MySQL

async function testConnections() {
    console.log('🔍 Testando conexões com bancos de dados...\n');

    // Test PostgreSQL (Protheus)
    try {
        console.log('📊 Testando PostgreSQL (Protheus)...');
        const result = await db.query('SELECT current_database(), version()');
        console.log('✅ PostgreSQL conectado:', result.rows[0].current_database);
        console.log('   Versão:', result.rows[0].version.split(',')[0]);
    } catch (err) {
        console.log('❌ Erro PostgreSQL:', err.message);
    }

    // Test MySQL (App)
    try {
        console.log('\n📊 Testando MySQL (App)...');
        const [rows] = await mysqlPool.query('SELECT DATABASE() as db, VERSION() as version');
        console.log('✅ MySQL conectado:', rows[0].db);
        console.log('   Versão:', rows[0].version);
    } catch (err) {
        console.log('❌ Erro MySQL:', err.message);
    }

    // Check if app_production_appointments table exists
    try {
        console.log('\n📋 Verificando tabela app_production_appointments...');
        const [tables] = await mysqlPool.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'app_production_appointments'
        `);

        if (tables[0].count > 0) {
            console.log('✅ Tabela app_production_appointments existe');

            // Get row count
            const [count] = await mysqlPool.query('SELECT COUNT(*) as total FROM app_production_appointments');
            console.log('   Total de registros:', count[0].total);

            // Get sample data
            if (count[0].total > 0) {
                const [sample] = await mysqlPool.query('SELECT * FROM app_production_appointments LIMIT 1');
                console.log('   Exemplo de registro:', {
                    id: sample[0].id,
                    op_numero: sample[0].op_numero,
                    usuario: sample[0].usuario,
                    quantidade: sample[0].quantidade,
                    data_fim: sample[0].data_fim
                });
            } else {
                console.log('   ⚠️  Tabela vazia - nenhum apontamento registrado');
            }
        } else {
            console.log('❌ Tabela app_production_appointments NÃO existe');
        }
    } catch (err) {
        console.log('❌ Erro ao verificar tabela:', err.message);
    }

    console.log('\n✅ Teste concluído!');
    process.exit(0);
}

testConnections().catch(err => {
    console.error('❌ Erro geral:', err);
    process.exit(1);
});
