
async function testQuery() {
    console.log("Testing complete filtered query with error handling...");
    const start = performance.now();
    try {
        const response = await fetch('http://localhost:3001/api/stock/balances?descricao=CHAP&limit=10');

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP Error ${response.status}:`, errorText);
            return;
        }

        const data = await response.json();
        const duration = performance.now() - start;
        console.log(`✅ Duration: ${duration.toFixed(2)}ms | Rows: ${data.length}`);
        console.log("First item:", JSON.stringify(data[0], null, 2));

        // Test no filter case
        console.log("\nTesting no filter (baseline)...");
        const start2 = performance.now();
        const response2 = await fetch('http://localhost:3001/api/stock/balances?limit=50');
        const data2 = await response2.json();
        console.log(`✅ Duration: ${(performance.now() - start2).toFixed(2)}ms | Rows: ${data2.length}`);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testQuery();
