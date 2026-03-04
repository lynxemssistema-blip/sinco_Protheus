
async function testNoFilter() {
    console.log("Testing no-filter query (first 10 products)...");
    try {
        const url = 'http://localhost:3001/api/stock/balances?limit=10';

        const start = performance.now();
        const response = await fetch(url);
        const duration = performance.now() - start;

        console.log("Duration:", duration.toFixed(2) + "ms");

        if (response.ok) {
            const data = await response.json();
            console.log("✅ Found", data.length, "products\n");

            data.forEach((item, i) => {
                console.log(`${i + 1}. Código: ${item.cod_produto.trim()}`);
                console.log(`   Desc: ${item.descricao.trim().substring(0, 60)}`);
                console.log(`   Saldo: ${item.saldo_atual}, Tipo: ${item.tipo.trim()}`);
                console.log("");
            });
        } else {
            const text = await response.text();
            console.error("❌ Error:", text);
        }
    } catch (e) {
        console.error("Exception:", e.message);
    }
}

testNoFilter();
