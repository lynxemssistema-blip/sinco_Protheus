
async function testTipoPa() {
    console.log("Testing query with tipo=PA (default filter)...");
    try {
        const url = 'http://localhost:3001/api/stock/balances?tipo=PA&limit=500';
        console.log("URL:", url);

        const response = await fetch(url);
        const text = await response.text();

        console.log("Status:", response.status);
        if (response.ok) {
            const data = JSON.parse(text);
            console.log("✅ Success! Rows:", data.length);
            console.log("First row:", JSON.stringify(data[0], null, 2));
        } else {
            console.error("❌ Error:", text);
        }
    } catch (e) {
        console.error("Exception:", e.message);
    }
}

testTipoPa();
