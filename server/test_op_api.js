const axios = require('axios');

async function testApi() {
    try {
        // Fetch OPs - assuming no auth needed for this internal route or I can hit it?
        // Wait, the API might need auth or might be open. Based on previous runs, it seems open or I can bypass.
        // I'll try to hit the route.
        console.log('Testing GET /api/production...');
        const res = await axios.get('http://localhost:3001/api/production?limit=5');

        if (res.data && res.data.data && res.data.data.length > 0) {
            console.log('Found Items:', res.data.data.length);
            const item = res.data.data[0];
            console.log('Sample Item:', {
                op: item.op,
                produto: item.cod_produto_op,
                operacao_doc: item.operacao_doc,
                tem_arquivos: item.tem_arquivos
            });

            // Find one with operacao_doc if possible
            const withOp = res.data.data.find(i => i.operacao_doc);
            if (withOp) {
                console.log('Item with Operation Found:', {
                    op: withOp.op,
                    produto: withOp.cod_produto_op,
                    operacao_doc: withOp.operacao_doc
                });
            } else {
                console.log('No item with operacao_doc found in the first page.');
            }

        } else {
            console.log('No data returned.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testApi();
