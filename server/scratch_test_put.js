const axios = require('axios');

async function test() {
    try {
        const res = await axios.put('http://localhost:5173/api/pcp-refinado/op/002373/dates', {
            data_inicio: '20260530',
            data_fim: '20260531'
        });
        console.log(res.data);
    } catch (e) {
        if (e.response) {
            console.error('Server responded with:', e.response.status, e.response.data);
        } else {
            console.error('Network error:', e.message);
        }
    }
}
test();
