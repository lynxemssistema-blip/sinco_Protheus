
async function comprehensiveTest() {
    console.log("=== COMPREHENSIVE API TEST ===\n");

    const tests = [
        { name: "No filters", url: "http://localhost:3001/api/stock/balances?limit=10" },
        { name: "Código MTA", url: "http://localhost:3001/api/stock/balances?codigo=MTA&limit=10" },
        { name: "Código SCL", url: "http://localhost:3001/api/stock/balances?codigo=SCL&limit=10" },
    ];

    for (const test of tests) {
        console.log(`\nTesting: ${test.name}`);
        console.log(`URL: ${test.url}`);

        try {
            const start = performance.now();
            const response = await fetch(test.url);
            const duration = performance.now() - start;

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ SUCCESS - Duration: ${duration.toFixed(2)}ms | Rows: ${data.length}`);

                if (data.length > 0) {
                    const first = data[0];
                    console.log(`   First: ${first.cod_produto.trim()} - ${first.descricao.trim().substring(0, 40)}`);
                }
            } else {
                const error = await response.text();
                console.log(`❌ FAILED - Status: ${response.status} | Error: ${error}`);
            }
        } catch (e) {
            console.log(`❌ EXCEPTION - ${e.message}`);
        }
    }
}

comprehensiveTest();
