
async function testPurchaseOrdersWithPV() {
    console.log("=== TESTE: API Pedidos de Compra com PV ===\n");

    const url = 'http://localhost:3001/api/compras/pedidos-com-pv?limit=5';
    console.log("URL:", url);
    console.log("Timestamp:", new Date().toISOString());

    try {
        const response = await fetch(url);
        console.log("\n✅ Status:", response.status);
        console.log("Headers:", Object.fromEntries(response.headers.entries()));

        const text = await response.text();

        if (response.ok) {
            const data = JSON.parse(text);
            console.log("\n✅ Sucesso! Registros retornados:", data.length);

            if (data.length > 0) {
                console.log("\n📋 Primeiro registro:");
                console.log(JSON.stringify(data[0], null, 2));

                console.log("\n📊 Campos disponíveis:");
                Object.keys(data[0]).forEach(key => {
                    console.log(`  - ${key}: ${data[0][key]}`);
                });

                console.log("\n📈 Estatísticas:");
                const stats = {
                    com_pc: data.filter(r => r.status_rastreamento === 'COM_PC').length,
                    com_sc: data.filter(r => r.status_rastreamento === 'COM_SC').length,
                    somente_pv: data.filter(r => r.status_rastreamento === 'SOMENTE_PV').length
                };
                console.log("  - COM_PC (com pedido compra):", stats.com_pc);
                console.log("  - COM_SC (com solicitação):", stats.com_sc);
                console.log("  - SOMENTE_PV (sem SC/PC):", stats.somente_pv);
            } else {
                console.log("\n⚠️  Nenhum registro encontrado (banco vazio ou filtros muito restritivos)");
            }
        } else {
            console.error("\n❌ Erro HTTP:", response.status);
            console.error("Resposta:", text);
        }
    } catch (error) {
        console.error("\n❌ Exceção:", error.message);
        console.error(error.stack);
    }
}

testPurchaseOrdersWithPV();
