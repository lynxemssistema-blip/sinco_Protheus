const axios = require('axios');

async function checkDebug() {
    try {
        const url = 'http://localhost:3001/api/production/debug-doc/MT5-27213';
        console.log(`Fetching ${url}...`);
        const res = await axios.get(url);
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error(err.message);
    }
}

checkDebug();
