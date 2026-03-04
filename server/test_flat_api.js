const axios = require('axios');

async function testFlat() {
    const url = 'http://localhost:3001/api/pedidos/flat?limit=1';
    try {
        const response = await axios.get(url);
        if (response.data && response.data.data && response.data.data.length > 0) {
            console.log('✅ Flat View keys:', Object.keys(response.data.data[0]));
            if (response.data.data[0].pedido) {
                console.log('✅ Pedido present:', response.data.data[0].pedido);
            } else {
                console.log('❌ Pedido MISSING in Flat View');
            }
        } else {
            console.log('❓ No data in Flat View.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testFlat();
