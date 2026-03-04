
const db = require('./db');

async function testQuery() {
    console.log("Testing specific filtered query...");
    const start = performance.now();
    try {
        const response = await fetch('http://localhost:3001/api/stock/balances?descricao=CHAP&limit=10');
        const data = await response.json();
        const duration = performance.now() - start;
        console.log(`Duration: ${duration.toFixed(2)}ms | Rows: ${data.length}`);
        console.log("First item:", data[0]);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testQuery();
