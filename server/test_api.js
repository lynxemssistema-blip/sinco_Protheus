const axios = require('axios');

async function test() {
    try {
        const res = await axios.get('http://localhost:3001/api/production/tracking-evolution');
        console.log("SUCCESS length:", res.data?.agrupado?.length);
    } catch (e) {
        console.error("ERROR:");
        console.error(e.response ? e.response.data : e.message);
    }
}
test();
