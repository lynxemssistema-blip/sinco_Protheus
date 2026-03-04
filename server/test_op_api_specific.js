const axios = require('axios');

async function testApi() {
    try {
        console.log('Testing GET /api/production?produto=MT5-27213...');
        const res = await axios.get('http://localhost:3001/api/production?produto=MT5-27213');

        if (res.data && res.data.data && res.data.data.length > 0) {
            console.log('Found Items:', res.data.data.length);
            res.data.data.forEach(item => {
                console.log('Item:', {
                    op: item.op,
                    produto: item.cod_produto_op,
                    operacao_doc: item.operacao_doc,
                    tem_arquivos: item.tem_arquivos,
                    doc_url: item.doc_url
                });
            });
        } else {
            console.log('No data returned for MT5-27213');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testApi();
