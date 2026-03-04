
const axios = require('axios');

async function verifyEndpoint() {
    try {
        console.log('🔍 Verifying /api/production/tracking-evolution...');
        // Mimic frontend call with some filters
        const url = 'http://localhost:3001/api/production/tracking-evolution?limit=5&data_inicio=2026-01-01&data_fim=2026-02-28';

        const response = await axios.get(url);

        console.log(`✅ Status: ${response.status} ${response.statusText}`);
        console.log('📦 Data Keys:', Object.keys(response.data));

        if (response.data.agrupado) {
            console.log(`✅ "agrupado" key found with ${response.data.agrupado.length} items.`);
        } else {
            console.error('❌ "agrupado" key MISSING in response!');
        }

    } catch (err) {
        console.error('❌ Request Failed:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

verifyEndpoint();
