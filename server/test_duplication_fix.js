
async function testDuplicationFix() {
    console.log("=== TESTE: Verificação de Duplicação (Após Fix) ===\n");

    const url = 'http://localhost:3001/api/compras/pedidos-com-pv?pv_numero=3716';
    console.log("URL:", url);
    console.log("Timestamp:", new Date().toISOString());
    console.log("\n🔍 Testando se ainda há duplicações...\n");

    try {
        const response = await fetch(url);

        if (response.ok) {
            const data = JSON.parse(await response.text());
            console.log("✅ Status: 200");
            console.log("✅ Total de registros:", data.length);

            // Verificar duplicações
            const uniqueKeys = new Set();
            const duplicates = [];

            data.forEach((row, index) => {
                const key = `${row.pv_numero}-${row.pv_item}`;
                if (uniqueKeys.has(key)) {
                    duplicates.push({ index, key, row });
                } else {
                    uniqueKeys.add(key);
                }
            });

            console.log("\n📊 Análise de Duplicação:");
            console.log("  - Registros únicos (PV + Item):", uniqueKeys.size);
            console.log("  - Total de registros:", data.length);
            console.log("  - Duplicações encontradas:", duplicates.length);

            if (duplicates.length > 0) {
                console.log("\n❌ AINDA HÁ DUPLICAÇÕES:");
                duplicates.forEach(dup => {
                    console.log(`  - ${dup.key} aparece duplicado no índice ${dup.index}`);
                    console.log(`    SC: ${dup.row.sc_numero}, PC: ${dup.row.pc_numero}`);
                });
            } else {
                console.log("\n✅ NENHUMA DUPLICAÇÃO ENCONTRADA! 🎉");
            }

            // Mostrar amostra dos dados
            if (data.length > 0) {
                console.log("\n📋 Primeira entrada:");
                const first = data[0];
                console.log(`  PV: ${first.pv_numero} (Item ${first.pv_item})`);
                console.log(`  Produto: ${first.produto_codigo}`);
                console.log(`  SC: ${first.sc_numero || 'N/A'}`);
                console.log(`  PC: ${first.pc_numero || 'N/A'}`);
                console.log(`  Status: ${first.status_rastreamento}`);
            }

            // Verificar quantos têm SC
            const comSC = data.filter(r => r.sc_numero).length;
            const comPC = data.filter(r => r.pc_numero).length;

            console.log("\n📈 Estatísticas:");
            console.log(`  - Com SC: ${comSC} (${((comSC / data.length) * 100).toFixed(1)}%)`);
            console.log(`  - Com PC: ${comPC} (${((comPC / data.length) * 100).toFixed(1)}%)`);
            console.log(`  - Somente PV: ${data.length - comSC} (${(((data.length - comSC) / data.length) * 100).toFixed(1)}%)`);

        } else {
            const text = await response.text();
            console.error("\n❌ Erro HTTP:", response.status);
            console.error("Resposta:", text);
        }
    } catch (error) {
        console.error("\n❌ Exceção:", error.message);
    }
}

testDuplicationFix();
