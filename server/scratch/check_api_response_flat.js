const http = require('http');

const url = 'http://localhost:3002/api/pedidos/flat?pedido=004159&only_active=false&limit=100';

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Total items received from API:', json.orders?.length);
            console.log('Has next page:', json.hasNextPage);
            const items = json.orders || [];
            const item01 = items.find(i => i.item === '01');
            console.log('Item 01 found:', item01 ? 'YES' : 'NO');
            if (item01) {
                console.log('Item 01 details:', JSON.stringify(item01, null, 2));
            } else {
                console.log('First 5 items items returned:');
                console.log(items.slice(0, 5).map(i => `Item: ${i.item} | Prod: ${i.codigo} | Qtd: ${i.quantidade} | Saldo: ${i.qtd_faturar}`));
            }
        } catch (e) {
            console.error('Error parsing response:', e.message);
            console.log('Raw data first 200 chars:', data.slice(0, 200));
        }
    });
}).on('error', (err) => {
    console.error('HTTP request failed:', err.message);
});
