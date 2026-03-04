const axios = require('axios');

async function testApi() {
    const url = 'http://localhost:3001/api/pedidos/pcp-forecasts';
    const data = {
        pedido: '002730',
        item: '01',
        data_entrega_pcp: '2026-02-10',
        quantidade_pcp: 600,
        usuario: 'Antigravity Test'
    };

    try {
        console.log('📡 Testing POST', url);
        const response = await axios.post(url, data);
        console.log('✅ Success:', response.data);
    } catch (error) {
        console.error('❌ Error:', error.response ? {
            status: error.response.status,
            data: error.response.data
        } : error.message);
    }
}

testApi();
