
async function testMtaSearch() {
    console.log("Testing search with codigo='MTA'...");
    try {
        const url = 'http://localhost:3001/api/stock/balances?codigo=MTA&limit=50';
        console.log("URL:", url);

        const start = performance.now();
        const response = await fetch(url);
        const duration = performance.now() - start;

        console.log("Status:", response.status);
        console.log("Duration:", duration.toFixed(2) + "ms");

        if (response.ok) {
            const data = await response.json();
            console.log("✅ Success! Found", data.length, "rows");
            console.log("\nFirst 3 results:");
            data.slice(0, 3).forEach((item, i) => {
                console.log(`\n${i + 1}. ${item.cod_produto.trim()} - ${item.descricao.trim()}`);
                console.log(`   Empresa: ${item.empresa}, Filial: ${item.filial}, Almox: ${item.almoxarifado}`);
                console.log(`   Saldo: ${item.saldo_atual}, Empenho: ${item.empenho}`);
            });
        } else {
            const text = await response.text();
            console.error("❌ Error:", text);
        }
    } catch (e) {
        console.error("Exception:", e.message);
    }
}

testMtaSearch();
