const axios = require('axios');

async function verifyPCPHistory() {
    const TEST_PEDIDO = 'V-TEST-' + Math.floor(Math.random() * 10000);
    const TEST_ITEM = '01';

    console.log(`🚀 Starting API-Based PCP Verification for Pedido: ${TEST_PEDIDO}`);

    const api = axios.create({
        baseURL: 'http://localhost:3001/api'
    });

    try {
        // 1. Save
        console.log('📡 Step 1: Saving PCP Forecast...');
        await api.post('/pedidos/pcp-forecasts', {
            pedido: TEST_PEDIDO,
            item: TEST_ITEM,
            data_entrega_pcp: '2026-12-31',
            quantidade_pcp: 777,
            usuario: 'Verifier Bot'
        });
        console.log('✅ Save successful.');

        // 2. Retrieve history
        console.log('📡 Step 2: Retrieving history from database via API...');
        const historyResponse = await api.get(`/pedidos/items/${TEST_PEDIDO}/${TEST_ITEM}/pcp-forecasts/history`);

        const records = historyResponse.data;
        if (records && records.length > 0) {
            const last = records[0];
            console.log('✅ Success! Found record in database:');
            console.log(JSON.stringify(last, null, 2));

            if (last.quantidade_pcp == 777 && last.usuario === 'Verifier Bot') {
                console.log('🏆 VERIFICATION RESULT: PASS (Data confirmed in DB)');
            } else {
                console.error('❌ Data mismatch!');
            }
        } else {
            console.error('❌ No records found in history after save!');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        if (error.response) console.log('   Error Data:', error.response.data);
    }
}

verifyPCPHistory();
