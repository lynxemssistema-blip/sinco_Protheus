
const db = require('./db');

async function runBenchmark() {
    console.log("Starting Benchmark...");

    const queries = [
        { name: "No Filter (Limit 500)", params: { limit: 500 } },
        { name: "Filter by Desc 'CHAP'", params: { descricao: 'CHAP', limit: 500 } },
        { name: "Filter by Group '01'", params: { grupo: '01', limit: 500 } },
        { name: "Filter by Code 'MT'", params: { codigo: 'MT', limit: 500 } }
    ];

    for (const q of queries) {
        const start = performance.now();
        try {
            const queryString = new URLSearchParams(q.params).toString();
            // Using global fetch available in Node.js 18+
            const response = await fetch(`http://localhost:3001/api/stock/balances?${queryString}`);
            const data = await response.json();

            const duration = performance.now() - start;
            console.log(`[${q.name}] Duration: ${duration.toFixed(2)}ms | Rows: ${data.length}`);
        } catch (err) {
            console.error(`[${q.name}] Failed: ${err.message}`);
        }
    }
}

runBenchmark();
