const axios = require('axios');

async function testItems() {
    const url = 'http://localhost:3001/api/pedidos/002730/itens';
    try {
        const response = await axios.get(url);
        if (response.data && response.data.length > 0) {
            console.log('✅ Result keys:', Object.keys(response.data[0]));
            console.log('✅ Sample item:', response.data[0]);
        } else {
            console.log('❓ No items found.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testItems();
