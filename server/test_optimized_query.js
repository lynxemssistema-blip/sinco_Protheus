/**
 * TEST - COMPARAÇÃO DE PERFORMANCE
 * Query antiga (LATERAL JOIN) vs Query nova (CTEs)
 */

const BASE_URL = 'http://localhost:3001';

async function testQueryPerformance() {
    console.log('⚡ TESTE DE PERFORMANCE - QUERY OTIMIZADA\n');
    console.log('='.repeat(60));

    const testCases = [
        {
            name: 'Filtro por Data (amplo)',
            params: 'data_pv_de=2024-01-01',
            expected: 'Muitos resultados'
        },
        {
            name: 'Filtro por Produto',
            params: 'produto=010101',
            expected: 'Resultados específicos'
        },
        {
            name: 'Filtro por PV',
            params: 'pv_numero=001234',
            expected: 'Resultado único'
        },
        {
            name: 'Múltiplos filtros',
            params: 'data_pv_de=2024-01-01&produto=010101',
            expected: 'Resultados filtrados'
        }
    ];

    console.log('\n🏃 Executando testes de velocidade...\n');

    for (const testCase of testCases) {
        console.log(`\n📊 ${testCase.name}`);
        console.log('-'.repeat(60));

        const start = Date.now();

        try {
            const response = await fetch(`${BASE_URL}/api/compras/pedidos-com-pv?${testCase.params}`);
            const data = await response.json();
            const duration = Date.now() - start;

            const recordCount = data.showing || data.data?.length || 0;

            console.log(`✓ Tempo: ${duration}ms`);
            console.log(`✓ Registros: ${recordCount}`);
            console.log(`✓ Aviso: ${data.warning || 'Nenhum'}`);

            // Classificar performance
            let status;
            if (duration < 2000) {
                status = '🚀 EXCELENTE';
            } else if (duration < 5000) {
                status = '✅ BOM';
            } else if (duration < 10000) {
                status = '⚠️ ACEITÁVEL';
            } else {
                status = '❌ LENTO';
            }

            console.log(`✓ Performance: ${status} (${duration}ms)`);

            // Meta: < 5s para todas as queries
            if (duration >= 10000) {
                console.log('⚠️ ALERTA: Query ainda está lenta!');
            }

        } catch (error) {
            console.error(`❌ ERRO: ${error.message}`);
        }

        // Aguardar entre testes
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 RESUMO');
    console.log('='.repeat(60));
    console.log('\nMetas de Performance:');
    console.log('  🚀 EXCELENTE: < 2s');
    console.log('  ✅ BOM: 2-5s');
    console.log('  ⚠️ ACEITÁVEL: 5-10s');
    console.log('  ❌ LENTO: > 10s');
    console.log('\nSe todas as queries estão < 5s, a otimização foi bem-sucedida!');
}

// Executar
console.log('🚀 Iniciando testes...\n');
testQueryPerformance().catch(console.error);
