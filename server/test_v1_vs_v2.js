/**
 * TESTE COMPARATIVO V1 vs V2
 * Compara a performance da query antiga (LATERAL JOIN) vs nova (CTE)
 */

const BASE_URL = 'http://localhost:3001';

async function compareVersions() {
    console.log('⚡ TESTE COMPARATIVO - V1 vs V2\n');
    console.log('='.repeat(70));

    const testCases = [
        {
            name: 'Filtro por Data',
            params: 'data_pv_de=2024-01-01&data_pv_ate=2024-12-31',
        },
        {
            name: 'Filtro por Produto',
            params: 'produto=010101',
        },
        {
            name: 'Filtro por PV',
            params: 'pv_numero=001234',
        }
    ];

    console.log('\n🏁 Iniciando testes...\n');

    const results = [];

    for (const testCase of testCases) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 ${testCase.name}`);
        console.log('='.repeat(70));

        // Teste V1
        console.log('\n🔵 Versão V1 (LATERAL JOIN)');
        console.log('-'.repeat(70));
        const startV1 = Date.now();

        try {
            const responseV1 = await fetch(`${BASE_URL}/api/compras/pedidos-com-pv?${testCase.params}`);
            const dataV1 = await responseV1.json();
            const durationV1 = Date.now() - startV1;

            const countV1 = dataV1.showing || dataV1.data?.length || dataV1.length || 0;

            console.log(`✓ Tempo: ${durationV1}ms`);
            console.log(`✓ Registros: ${countV1}`);

            // Aguardar 1s entre testes
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Teste V2
            console.log('\n🟢 Versão V2 (CTE OTIMIZADA)');
            console.log('-'.repeat(70));
            const startV2 = Date.now();

            const responseV2 = await fetch(`${BASE_URL}/api/compras/pedidos-com-pv-v2?${testCase.params}`);
            const dataV2 = await responseV2.json();
            const durationV2 = Date.now() - startV2;

            const countV2 = dataV2.showing || dataV2.data?.length || 0;

            console.log(`✓ Tempo: ${durationV2}ms`);
            console.log(`✓ Registros: ${countV2}`);
            console.log(`✓ Versão: ${dataV2.version || 'N/A'}`);

            // Comparação
            console.log('\n📈 COMPARAÇÃO');
            console.log('-'.repeat(70));

            const improvement = ((durationV1 - durationV2) / durationV1 * 100).toFixed(1);
            const speedup = (durationV1 / durationV2).toFixed(2);

            if (durationV2 < durationV1) {
                console.log(`✅ V2 é ${improvement}% mais rápida`);
                console.log(`✅ V2 é ${speedup}x mais rápida que V1`);
            } else {
                console.log(`⚠️ V1 foi mais rápida neste teste`);
            }

            console.log(`   V1: ${durationV1}ms`);
            console.log(`   V2: ${durationV2}ms`);
            console.log(`   Diferença: ${Math.abs(durationV1 - durationV2)}ms`);

            // Verificar consistência de resultados
            if (countV1 === countV2) {
                console.log(`✅ Mesma quantidade de registros (${countV1})`);
            } else {
                console.log(`⚠️ Quantidades diferentes: V1=${countV1}, V2=${countV2}`);
            }

            results.push({
                test: testCase.name,
                v1: durationV1,
                v2: durationV2,
                improvement: improvement,
                speedup: speedup,
                recordsV1: countV1,
                recordsV2: countV2
            });

        } catch (error) {
            console.error(`❌ ERRO: ${error.message}`);
        }

        // Aguardar entre casos de teste
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Resumo Final
    console.log('\n\n' + '='.repeat(70));
    console.log('📊 RESUMO FINAL');
    console.log('='.repeat(70));

    console.log('\n| Teste                | V1 (ms) | V2 (ms) | Melhoria | Speedup |');
    console.log('|' + '-'.repeat(68) + '|');

    results.forEach(r => {
        console.log(`| ${r.test.padEnd(20)} | ${String(r.v1).padStart(7)} | ${String(r.v2).padStart(7)} | ${(r.improvement + '%').padStart(8)} | ${(r.speedup + 'x').padStart(7)} |`);
    });

    const avgImprovement = (results.reduce((sum, r) => sum + parseFloat(r.improvement), 0) / results.length).toFixed(1);

    console.log('\n' + '='.repeat(70));
    console.log(`⚡ Melhoria Média: ${avgImprovement}%`);

    if (parseFloat(avgImprovement) > 50) {
        console.log('🎉 SUCESSO! Melhoria significativa de performance!');
    } else if (parseFloat(avgImprovement) > 20) {
        console.log('✅ BOM! Melhoria moderada de performance.');
    } else {
        console.log('⚠️ Melhoria marginal. Considere otimizações adicionais.');
    }

    console.log('\n💡 Se V2 for consistentemente mais rápida, substitua V1 por V2 na rota principal.');
}

// Executar
console.log('🚀 Iniciando testes comparativos...\n');
compareVersions().catch(console.error);
