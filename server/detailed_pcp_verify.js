const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration from .env
const mysqlConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
};

async function verifyPCPDatabase() {
    const TEST_PEDIDO = 'TEST-' + Math.floor(Math.random() * 10000);
    const TEST_ITEM = '01';

    console.log(`🚀 Starting DETAILED PCP Database Save Verification for Pedido: ${TEST_PEDIDO}`);

    const api = axios.create({
        baseURL: 'http://localhost:3001/api'
    });

    try {
        // 1. Perform Save via API
        console.log('📡 Step 1: Saving PCP Forecast via API...');
        const saveResponse = await api.post('/pedidos/pcp-forecasts', {
            pedido: TEST_PEDIDO,
            item: TEST_ITEM,
            data_entrega_pcp: '2026-12-31',
            quantidade_pcp: 999,
            usuario: 'Antigravity Verification'
        });

        if (saveResponse.data.success) {
            console.log('✅ API returned success.');
        } else {
            console.error('❌ API returned failure:', saveResponse.data);
            return;
        }

        // 2. Verify directly in MySQL
        console.log('🗄️  Step 2: Checking MySQL Database directly...');
        const connection = await mysql.createConnection(mysqlConfig);

        try {
            const [rows] = await connection.execute(
                'SELECT * FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY id DESC LIMIT 1',
                [TEST_PEDIDO, TEST_ITEM]
            );

            if (rows.length > 0) {
                const record = rows[0];
                console.log('✅ Record FOUND in database:');
                console.log(`   - ID: ${record.id}`);
                console.log(`   - Pedido: ${record.pedido}`);
                console.log(`   - Item: ${record.item}`);
                console.log(`   - Data: ${record.data_entrega_pcp}`);
                console.log(`   - Qtd: ${record.quantidade_pcp}`);
                console.log(`   - User: ${record.usuario}`);
                console.log(`   - Created At: ${record.created_at}`);

                if (record.quantidade_pcp === 999) {
                    console.log('🏆 FINAL VERIFICATION: PASS');
                } else {
                    console.error('❌ Data mismatch in quantity!');
                }
            } else {
                console.error('❌ Record NOT FOUND in database after successful API response!');
            }
        } finally {
            await connection.end();
        }

    } catch (error) {
        console.error('❌ Critical Error during verification:', error.message);
        if (error.response) console.error('   API Data:', error.response.data);
    }
}

verifyPCPDatabase();
