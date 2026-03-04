const axios = require('axios');

async function testList() {
    const url = 'http://localhost:3001/api/pedidos?limit=5';
    try {
        const response = await axios.get(url);
        if (response.data && response.data.data && response.data.data.length > 0) {
            console.log('✅ Result keys:', Object.keys(response.data.data[0]));
            response.data.data.forEach(p => {
                console.log(`Pedido: '${p.pedido}' (Length: ${p.pedido.length})`);
            });
        } else {
            console.log('❓ No items found.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testList();
