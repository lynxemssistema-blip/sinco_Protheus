const axios = require('axios');

async function checkApi() {
    try {
        const res = await axios.get('http://localhost:3001/api/production/processes');
        console.log("Status:", res.status);
        if (res.data.length > 0) {
            console.log("First item:", res.data[0]);
            console.log("Checking properties...");
            if (res.data[0].desc_recurso) {
                console.log("❌ Has desc_recurso directly? This means raw PG result without mapping OR old query.");
            } else if (res.data[0].codigo && res.data[0].descricao) {
                console.log("✅ Has mapped fields (codigo, descricao).");
                if (res.data[0].codigo.startsWith('MO')) {
                    console.log("✅ Looks like Resource Code (e.g. MO0001). Correct!");
                } else {
                    console.log("⚠️ Value doesn't look like MOxxxx. Might still be old operations list?");
                }
            } else {
                console.log("⚠️ Unknown structure:", Object.keys(res.data[0]));
            }
        } else {
            console.log("Empty list returned.");
        }
    } catch (err) {
        console.error("Error fetching API:", err.message);
    }
}

checkApi();
