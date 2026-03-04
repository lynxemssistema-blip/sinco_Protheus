const axios = require('axios');

async function verifyItens() {
    try {
        const response = await axios.get('http://localhost:3001/api/pedidos/002553/itens');
        console.log(`Total items returned: ${response.data.length}`);

        // Check for new field names
        const firstItem = response.data[0];
        console.log('Sample item fields:', Object.keys(firstItem));

        const withBalance = response.data.filter(i => parseFloat(i.qtd_faturar) > 0);
        console.log('Items with balance (qtd_faturar > 0):');
        console.table(withBalance.map(i => ({
            item: i.item,
            produto: i.codigo,
            quantidade: i.quantidade,
            qtd_entreg: i.qtd_entreg,
            faturar: i.qtd_faturar
        })));
    } catch (err) {
        console.error('Fetch error:', err.response ? err.response.data : err.message);
    }
}

verifyItens();
