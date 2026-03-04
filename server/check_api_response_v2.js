const axios = require('axios');

async function checkApi() {
    try {
        // Adding cache buster just in case axios caches (unlikely in node but good practice here)
        const res = await axios.get('http://localhost:3001/api/production/processes?t=' + Date.now());
        console.log("Status:", res.status);
        console.log("Response Type:", typeof res.data);
        if (res.data.debug_sql) {
            console.log("✅ API returns debug_sql!");
            console.log("SQL:", res.data.debug_sql);
        } else {
            console.log("❌ API does NOT return debug_sql. Old version running?");
        }

        const items = res.data.data || (Array.isArray(res.data) ? res.data : []);
        if (items.length > 0) {
            const st0055 = items.find(i => i.codigo === 'ST0055');
            if (st0055) {
                console.log("ST0055 Data:", st0055);
            } else {
                console.log("ST0055 not found in list.");
            }
        }
    } catch (err) {
        console.error("Error fetching API:", err.message);
    }
}

checkApi();
