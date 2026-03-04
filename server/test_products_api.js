const axios = require('axios');

async function testProductsApi() {
    const searchCode = 'MT6-7283';
    console.log(`Testing Products API for Code: ${searchCode}`);
    try {
        const res = await axios.get(`http://localhost:3001/api/produtos`, {
            params: {
                code: searchCode,
                limit: 10
            }
        });

        const products = res.data.data;
        console.log(`Found ${products.length} products.`);

        const focusProduct = products.find(p => p.codigo.trim() === searchCode);

        if (focusProduct) {
            console.log('✅ Focus Product Found:');
            console.log('Codigo:', JSON.stringify(focusProduct.codigo));
            console.log('Tem Arquivos:', focusProduct.tem_arquivos);
            console.log('Arquivos Count:', focusProduct.arquivos_count);
            console.log('Lista Docs (Preview):', focusProduct.imagem_url ? 'Has Image' : 'No Image');
        } else {
            console.log('❌ Product MT6-7283 not found in API response.');
        }

    } catch (err) {
        console.error('API Error:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

testProductsApi();
